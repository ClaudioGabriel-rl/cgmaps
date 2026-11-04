// ============================================
// SUPABASE CLIENT - CGMaps (Versão Final)
// ============================================

const SUPABASE_URL = 'https://kmtfghntznfvuniiwugv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_FWu_HHq3GlAt91E-irf3SA_dWjMJQ9H';

// Inicializa e expõe GLOBALMENTE como window.supabaseClient
window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('✅ CGMaps - Supabase client inicializado');

// Listener de autenticação
window.supabaseClient.auth.onAuthStateChange((event, session) => {
  console.log('Auth event:', event);
  if (event === 'SIGNED_IN' && window.onUserSignedIn) {
    window.onUserSignedIn(session.user);
  }
  if (event === 'SIGNED_OUT' && window.onUserSignedOut) {
    window.onUserSignedOut();
  }
});
