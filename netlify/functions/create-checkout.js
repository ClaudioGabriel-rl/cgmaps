// Netlify Function - Criar checkout Stripe/Pix
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { planoId, moeda, metodo } = JSON.parse(event.body);
    const userToken = event.headers.authorization?.replace('Bearer ', '');

    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: { user } } = await supabase.auth.getUser(userToken);
    if (!user) return { statusCode: 401, body: 'Não autorizado' };

    const { data: plano } = await supabase
      .from('planos')
      .select('*')
      .eq('id', planoId)
      .single();

    if (!plano) return { statusCode: 404, body: 'Plano não encontrado' };

    if (metodo === 'stripe') {
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      
      const priceMap = { BRL: plano.preco_brl, USD: plano.preco_usd, EUR: plano.preco_eur };
      const valor = priceMap[moeda] || plano.preco_brl;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: moeda.toLowerCase(),
            product_data: { name: `Plano ${plano.nome} - CGMaps` },
            unit_amount: Math.round(valor * 100),
            recurring: { interval: 'month' }
          },
          quantity: 1
        }],
        mode: 'subscription',
        success_url: `${process.env.URL}/?success=true`,
        cancel_url: `${process.env.URL}/?canceled=true`,
        customer_email: user.email,
        metadata: { user_id: user.id, plano_id: planoId }
      });

      await supabase.from('pagamentos').insert({
        user_id: user.id,
        plano_id: planoId,
        metodo: 'stripe',
        valor,
        moeda,
        status: 'pendente',
        stripe_session_id: session.id
      });

      return { statusCode: 200, body: JSON.stringify({ url: session.url }) };
    }

    if (metodo === 'pix') {
      const response = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          transaction_amount: plano.preco_brl,
          description: `Plano ${plano.nome} - CGMaps`,
          payment_method_id: 'pix',
          payer: { email: user.email },
          metadata: { user_id: user.id, plano_id: planoId }
        })
      });

      const pixData = await response.json();

      await supabase.from('pagamentos').insert({
        user_id: user.id,
        plano_id: planoId,
        metodo: 'pix',
        valor: plano.preco_brl,
        moeda: 'BRL',
        status: 'pendente',
        external_id: pixData.id
      });

      return {
        statusCode: 200,
        body: JSON.stringify({
          qr_code: pixData.point_of_interaction.transaction_data.qr_code,
          qr_code_base64: pixData.point_of_interaction.transaction_data.qr_code_base64
        })
      };
    }

    return { statusCode: 400, body: 'Método inválido' };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
