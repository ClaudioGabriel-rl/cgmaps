const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
  try {
    const payload = JSON.parse(event.body);
    
    // A Cakto envia o ID da cobrança e o status
    const chargeId = payload.id;
    const status = payload.status;

    // Se o pagamento foi aprovado (status pode variar, geralmente 'paid' ou 'APROVADA')
    if (status === 'paid' || status === 'APROVADA' || payload.paid_at) {
      
      // Busca o pagamento no banco pelo ID da cobrança (external_id)
      const { data: payment } = await supabase
        .from('pagamentos')
        .select('user_id, plano_id')
        .eq('external_id', chargeId)
        .single();

      if (payment) {
        // Atualiza o plano do usuário
        await supabase.from('profiles').update({ plano: payment.plano_id }).eq('id', payment.user_id);
        // Marca o pagamento como aprovado
        await supabase.from('pagamentos').update({ status: 'aprovado' }).eq('external_id', chargeId);
      }
    }

    return { statusCode: 200, body: 'OK' };
  } catch (error) {
    console.error('Erro no webhook Cakto:', error);
    return { statusCode: 400, body: 'Erro' };
  }
};
