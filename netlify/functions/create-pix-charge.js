// ==========================================
// FUNÇÃO DE PAGAMENTO PIX (CAKTO) - VERSÃO FINAL CORRETIVA
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
    if (!apiKey) {
      throw new Error('A variável CAKTO_API_KEY não está configurada no Netlify.');
    }

    const body = JSON.parse(event.body);
    console.log('📦 Dados recebidos do site:', body);

    // ENDEREÇO CORRETO DA API DA CAKTO
    const response = await fetch('https://api.cakto.com.br/public_api/payments/', { 
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': crypto.randomUUID() // Exigido pela Cakto para evitar cobranças duplicadas
      },
      body: JSON.stringify({
        customer: {
          name: body.customer?.name || 'Cliente Teste',
          email: body.customer?.email || 'teste@teste.com'
        },
        items: [
          {
            offerId: body.plano_id || 'pro', // ⚠️ IMPORTANTE: Deve ser um ID de oferta válido criado no painel da Cakto
            quantity: 1
          }
        ],
        pixExpiresIn: 30 // O Pix expira em 30 minutos
      })
    });

    const data = await response.json();
    console.log('📡 Resposta da Cakto:', data);

    if (!response.ok) {
      throw new Error(data.message || JSON.stringify(data));
    }

    // A Cakto retorna o QR Code dentro do objeto 'pix'
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
