exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };

  try {
    const { amount, customer, description, user_id, plano_id } = JSON.parse(event.body || '{}');
    const token = process.env.CAKTO_API_TOKEN;

    if (!token) throw new Error('Token da Cakto não configurado no Netlify.');

    // Chama a API da Cakto para criar o Pix
    const response = await fetch('https://api.cakto.com.br/v1/charges', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: amount, // Valor em centavos (ex: 3900 para R$ 39,00)
        payment_method: 'pix',
        customer: customer, // { name, email, cpf }
        items: [{ description: description || 'Plano CGMaps', amount: amount, quantity: 1 }],
        metadata: { user_id, plano_id } // Metadados para o webhook identificar
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Erro ao gerar Pix na Cakto');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        qr_code: data.qr_code,
        qr_code_base64: data.qr_code_base64,
        charge_id: data.id
      })
    };
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
