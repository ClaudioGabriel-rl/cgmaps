// ==========================================
// FUNÇÃO DE PAGAMENTO PIX (CAKTO) - VERSÃO HÍBRIDA
// Tenta API Key simples OU OAuth2 automaticamente
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
    const apiKey = process.env.CAKTO_API_KEY;
    const clientId = process.env.CAKTO_CLIENT_ID;
    const clientSecret = process.env.CAKTO_CLIENT_SECRET;
    
    console.log('🔑 Variáveis disponíveis:');
    console.log('  - CAKTO_API_KEY:', !!apiKey);
    console.log('  - CAKTO_CLIENT_ID:', !!clientId);
    console.log('  - CAKTO_CLIENT_SECRET:', !!clientSecret);

    const body = JSON.parse(event.body);
    console.log('📦 Dados recebidos:', body);

    let accessToken = null;

    // MÉTODO 1: Tenta OAuth2 primeiro (se tiver client_id e client_secret)
    if (clientId && clientSecret) {
      console.log('🔐 Tentando OAuth2...');
      try {
        const tokenResponse = await fetch('https://api.cakto.com.br/public_api/token/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'client_credentials'
          })
        });

        const tokenData = await tokenResponse.json();
        console.log('🔐 Resposta OAuth2:', tokenData);

        if (tokenResponse.ok && tokenData.access_token) {
          accessToken = tokenData.access_token;
          console.log('✅ Token OAuth2 obtido com sucesso');
        }
      } catch (e) {
        console.log('⚠️ OAuth2 falhou:', e.message);
      }
    }

    // MÉTODO 2: Usa API Key simples (se tiver)
    if (!accessToken && apiKey) {
      console.log('🔑 Usando API Key simples');
      accessToken = apiKey;
    }

    // Se nenhum método funcionou, erro
    if (!accessToken) {
      throw new Error('Nenhuma credencial válida configurada. Configure CAKTO_API_KEY ou CAKTO_CLIENT_ID + CAKTO_CLIENT_SECRET no Netlify.');
    }

    // Cria a cobrança Pix
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
    console.error('💥 ERRO FATAL:', error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Erro no servidor', details: error.message })
    };
  }
};
