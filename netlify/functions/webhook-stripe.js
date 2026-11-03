// Netlify Function - Webhook Stripe
exports.handler = async (event) => {
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  const sig = event.headers['stripe-signature'];

  try {
    const evt = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    if (evt.type === 'checkout.session.completed') {
      const session = evt.data.object;
      const userId = session.metadata.user_id;
      const planoId = session.metadata.plano_id;

      await supabase
        .from('profiles')
        .update({ plano: planoId })
        .eq('id', userId);

      await supabase
        .from('pagamentos')
        .update({ status: 'aprovado' })
        .eq('stripe_session_id', session.id);
    }

    if (evt.type === 'customer.subscription.deleted') {
      const subscription = evt.data.object;
      const { data: pagamento } = await supabase
        .from('pagamentos')
        .select('user_id')
        .eq('stripe_session_id', subscription.id)
        .single();

      if (pagamento) {
        await supabase
          .from('profiles')
          .update({ plano: 'free' })
          .eq('id', pagamento.user_id);
      }
    }

    return { statusCode: 200, body: 'OK' };
  } catch (error) {
    return { statusCode: 400, body: `Webhook Error: ${error.message}` };
  }
};
