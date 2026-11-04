exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    const apiKey = process.env.CAKTO_API_KEY;
    console.log('🔑 API Key presente?', !!apiKey); // Verifica se a chave chegou

    if (!apiKey) {
      throw new Error('A variável CAKTO_API_KEY não está configurada no Netlify.');
    }

    const body = JSON.parse(event.body);
    console.log('📦 Dados recebidos do site:', body);

    // Tenta fazer a chamada à Cakto
    const response = await fetch('https://api.cakto.com.br/v1/charges', { 
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: body.amount || 3900, // Valor de teste em centavos se não vier
        payment_method: 'pix',
        customer: {
          name: body.customer?.name || 'Cliente Teste',
          email: body.customer?.email || 'teste@teste.com'
        },
        description: body.description || 'Assinatura CGMaps'
      })
    });

    const data = await response.json();
    console.log('📡 Resposta da Cakto:', data);

    if (!response.ok) {
      throw new Error(data.message || JSON.stringify(data));
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        qr_code: data.qr_code || data.pix?.qr_code,
        qr_code_base64: data.qr_code_base64 || data.pix?.qr_code_base64,
        transaction_id: data.id
      })
    };

  } catch (error) {
    // AQUI ESTÁ O SEGREDO: Agora o erro real vai aparecer no log do Netlify
    console.error('💥 ERRO FATAL NO PIX:', error.message);
    console.error('💥 STACK COMPLETA:', error.stack);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Erro no servidor', details: error.message })
    };
  }
};
