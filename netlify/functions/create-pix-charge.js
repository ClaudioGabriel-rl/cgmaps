// ==========================================
// FUNÇÃO DE PAGAMENTO PIX (CAKTO) - COM OAUTH2
// ==========================================

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Idempotency-Key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    const clientId = process.env.CAKTO_CLIENT_ID;
    const clientSecret = process.env.CAKTO_CLIENT_SECRET;
    
    console.log('🔑 Client ID presente?', !!clientId);
    console.log('🔑 Client Secret presente?', !!clientSecret);
    
    if (!clientId || !clientSecret) {
      throw new Error('CAKTO_CLIENT_ID ou CAKTO_CLIENT_SECRET não configurados no Netlify.');
    }

    const body = JSON.parse(event.body);
    console.log('📦 Dados recebidos do site:', body);

    // ETAPA 1: Obter o access_token via OAuth2
    console.log('🔐 Obtendo access_token da Cakto...');
    const tokenResponse = await fetch('https://api.cakto.com.br/public_api/token/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials'
      })
    });

    const tokenData = await tokenResponse.json();
    console.log('🔐 Resposta do token:', tokenData);

    if (!tokenResponse.ok || !tokenData.access_token) {
      throw new Error('Falha ao obter token: ' + JSON.stringify(tokenData));
    }

    const accessToken = tokenData.access_token;
    console.log('✅ Token obtido com sucesso');

    // ETAPA 2: Criar a cobrança Pix com o token
    console.log('💳 Criando cobrança Pix...');
    const response = await fetch('https://api.cakto.com.br/public_api/payments/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': crypto.randomUUID()
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
    console.log('📡 Resposta da Cakto:', data);

    if (!response.ok) {
      throw new Error(data.message || JSON.stringify(data));
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
    console.error('💥 ERRO FATAL NO PIX:', error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Erro no servidor', details: error.message })
    };
  }
};
