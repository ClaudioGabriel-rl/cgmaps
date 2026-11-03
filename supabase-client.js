// ============================================
// SUPABASE CLIENT - CGMaps (Versão Completa)
// ============================================

// 1. SUAS CREDENCIAIS DO SUPABASE
// ⚠️ ATENÇÃO: Cole a chave ANON PUBLIC (não a service_role) e mantenha tudo em uma linha só.
const SUPABASE_URL = 'https://kmtfghntznfvuniiwugv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_FWu_HHq3GlAt91E-irf3SA_dWjMJQ9H';

// 2. INICIALIZAÇÃO DO CLIENTE
// Usamos 'supabaseClient' para evitar conflito com a biblioteca global
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// FUNÇÕES DE AUTENTICAÇÃO
// ============================================
async function authSignup(nome, email, password) {
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: { data: { nome, tipo: 'user' } }
  });
  if (error) throw error;
  return data;
}

async function authLogin(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function authLogout() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) throw error;
}

async function authGetUser() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  return user;
}

async function authGetSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  return session;
}

// ============================================
// FUNÇÕES DE PERFIL
// ============================================
async function getProfile() {
  const user = await authGetUser();
  if (!user) return null;
  
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('*, planos(nome, limite_mapas, limite_ia, preco_brl, preco_usd, preco_eur, features)')
    .eq('id', user.id)
    .single();
  
  if (error) throw error;
  return data;
}

// ============================================
// FUNÇÕES DE MAPAS
// ============================================
async function listarMapas() {
  const user = await authGetUser();
  if (!user) return [];
  
  const { data, error } = await supabaseClient
    .from('mapas')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

async function criarMapa(nome) {
  const user = await authGetUser();
  if (!user) throw new Error('Não autenticado');
  
  const { data, error } = await supabaseClient
    .from('mapas')
    .insert({
      user_id: user.id,
      nome,
      dados: [{ id: '1', texto: 'Ideia Central', x: 2350, y: 2450, paiId: null, prioridade: 'sem', detalhes: null }]
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

async function salvarMapa(mapaId, nome, dados) {
  const { error } = await supabaseClient
    .from('mapas')
    .update({ nome, dados, updated_at: new Date().toISOString() })
    .eq('id', mapaId);
  if (error) throw error;
}

async function excluirMapa(mapaId) {
  const { error } = await supabaseClient.from('mapas').delete().eq('id', mapaId);
  if (error) throw error;
}

async function renomearMapa(mapaId, nome) {
  const { error } = await supabaseClient
    .from('mapas')
    .update({ nome, updated_at: new Date().toISOString() })
    .eq('id', mapaId);
  if (error) throw error;
}

// ============================================
// FUNÇÕES DE PLANOS
// ============================================
async function listarPlanos() {
  const { data, error } = await supabaseClient
    .from('planos')
    .select('*')
    .eq('ativo', true)
    .order('preco_brl');
  if (error) throw error;
  return data || [];
}

// ============================================
// FUNÇÕES DE IA (VIA BACKEND SEGURO)
// ============================================
async function chamarIA(provider, model, messages, maxTokens = 2000) {
  const session = await authGetSession();
  if (!session) throw new Error('Não autenticado');

  const response = await fetch('/.netlify/functions/ai-proxy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    },
    body: JSON.stringify({ provider, model, messages, max_tokens: maxTokens })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Erro na IA');
  return data.content;
}

// ============================================
// FUNÇÕES DE PAGAMENTO
// ============================================
async function criarCheckout(planoId, moeda, metodo) {
  const session = await authGetSession();
  if (!session) throw new Error('Não autenticado');

  const response = await fetch('/.netlify/functions/create-checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    },
    body: JSON.stringify({ planoId, moeda, metodo })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Erro no checkout');
  return data;
}

// ============================================
// FUNÇÕES ADMIN
// ============================================
async function adminListarUsuarios() {
  const { data, error } = await supabaseClient.from('profiles').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function adminAtualizarUsuario(userId, updates) {
  const { error } = await supabaseClient.from('profiles').update(updates).eq('id', userId);
  if (error) throw error;
}

async function adminListarTodosMapas() {
  const { data, error } = await supabaseClient.from('mapas').select('*, profiles(nome, email)').order('updated_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function adminListarPlanos() {
  const { data, error } = await supabaseClient.from('planos').select('*').order('preco_brl');
  if (error) throw error;
  return data || [];
}

async function adminSalvarPlano(plano) {
  const { error } = await supabaseClient.from('planos').upsert(plano);
  if (error) throw error;
}

async function adminExcluirPlano(planoId) {
  const { error } = await supabaseClient.from('planos').delete().eq('id', planoId);
  if (error) throw error;
}

async function adminListarPagamentosPendentes() {
  const { data, error } = await supabaseClient.from('pagamentos').select('*, profiles(nome, email)').eq('status', 'pendente').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function adminAprovarPagamento(pagamentoId, planoId) {
  const { data: pagamento } = await supabaseClient.from('pagamentos').select('user_id').eq('id', pagamentoId).single();
  if (!pagamento) throw new Error('Pagamento não encontrado');
  await supabaseClient.from('pagamentos').update({ status: 'aprovado' }).eq('id', pagamentoId);
  await supabaseClient.from('profiles').update({ plano: planoId }).eq('id', pagamento.user_id);
}

// ============================================
// LISTENER DE AUTENTICAÇÃO
// ============================================
supabaseClient.auth.onAuthStateChange((event, session) => {
  console.log('Auth event:', event);
  if (event === 'SIGNED_IN' && window.onUserSignedIn) {
    window.onUserSignedIn(session.user);
  }
  if (event === 'SIGNED_OUT' && window.onUserSignedOut) {
    window.onUserSignedOut();
  }
});

console.log('✅ CGMaps - Supabase client inicializado');
