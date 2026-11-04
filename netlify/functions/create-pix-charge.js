// ==========================================
// FUNÇÃO DE PAGAMENTO PIX (CAKTO) - À PROVA DE FALHAS
// ==========================================

exports.handler = async (event) => {
  // 1. Configuração de Headers (Obrigatório para o site conseguir ler a resposta)
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Responde ao pré-voo do navegador
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // 2. Verifica se a Chave da Cakto está configurada no Netlify
    const apiKey = process.env.CAKTO_API_KEY;
    
    if (!apiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'A chave CAKTO_API_KEY não está configurada nas variáveis de ambiente do Netlify.' })
      };
    }

    // 3. Pega os dados enviados pelo site
    const body = JSON.parse(event.body);
    const { amount, customer, description } = body;

    // 4. Envia o pedido para a Cakto
    // ⚠️ ATENÇÃO: Se a Cakto exigir autenticação básica (Client ID:Secret), mude a linha do Authorization para:
    // 'Authorization': 'Basic ' + Buffer.from(`${process.env.CAKTO_CLIENT_ID}:${process.env.CAKTO_CLIENT_SECRET}`).toString('base64'),
    
    const response = await fetch('https://api.cakto.com.br/v1/charges', { 
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`, // Usa a API Key ou Client Secret
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: amount, // Valor em centavos
        payment_method: 'pix',
        customer: {
          name: customer.name,
          email: customer.email
        },
        description: description
      })
    });

    const data = await response.json();

    // 5. Se a Cakto recusar, devolve o erro dela em formato JSON (não HTML)
    if (!response.ok) {
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: data.message || 'Erro ao gerar Pix na Cakto', details: data })
      };
    }

    // 6. Sucesso! Devolve o QR Code para o site
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
    // 7. O "Pulo do Gato": Se qualquer coisa der errado, captura o erro e devolve JSON.
    // Isso impede o erro "Unexpected token '<'" de aparecer no site.
    console.error('Erro fatal na função:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Erro interno do servidor.', details: error.message })
    };
  }
};
