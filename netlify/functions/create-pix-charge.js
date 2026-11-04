exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Gera chave de idempotência de forma 100% segura (sem depender de módulos externos)
    const idempotencyKey = Date.now().toString() + Math.random().toString(36).substring(2);

    const apiKey = process.env.CAKTO_API_KEY;
    const clientId = process.env.CAKTO_CLIENT_ID;
    const clientSecret = process.env.CAKTO_CLIENT_SECRET;
    
    let authHeader = '';

    // Tenta OAuth2 primeiro
    if (clientId && clientSecret) {
      const tokenRes = await fetch('https://api.cakto.com.br/public_api/token/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' })
      });
      const tokenData = await tokenRes.json();
      if (tokenData.access_token) {
        authHeader = `Bearer ${tokenData.access_token}`;
      }
    }
    
    // Se falhar ou não tiver, tenta API Key simples
    if (!authHeader && apiKey) {
      authHeader = `Bearer ${apiKey}`;
    }

    if (!authHeader) {
      throw new Error('Faltam credenciais da Cakto no Netlify (Configure CAKTO_API_KEY ou CAKTO_CLIENT_ID + CAKTO_CLIENT_SECRET).');
    }

    const body = JSON.parse(event.body || '{}');
    
    // Chama a API da Cakto
    const response = await fetch('https://api.cakto.com.br/public_api/payments/', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify({
        customer: { 
          name: body.customer?.name || 'Cliente Teste', 
          email: body.customer?.email || 'teste@teste.com' 
        },
        items: [
          { 
            offerId: body.plano_id || 'pro', 
            quantity: 1 
          }
        ],
        pixExpiresIn: 30
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || data.message || JSON.stringify(data));
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        qr_code: data.pix?.qrCode || data.qrCode,
        qr_code_base64: data.pix?.qrCodeBase64 || data.qrCodeBase64,
        transaction_id: data.id
      })
    };

  } catch (error) {
    // Agora sim, o erro vai chegar limpo no seu navegador
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Erro no servidor', 
        details: error.message 
      })
    };
  }
};
