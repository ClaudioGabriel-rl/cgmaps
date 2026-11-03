a// Netlify Function - Proxy seguro para IA
exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { provider, model, messages, max_tokens } = JSON.parse(event.body);
    const userToken = event.headers.authorization?.replace('Bearer ', '');
    
    if (!userToken) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Não autorizado' }) };
    }

    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(userToken);
    if (authError || !user) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Token inválido' }) };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('plano, uso_ia_quantidade, uso_ia_mes')
      .eq('id', user.id)
      .single();

    const { data: plano } = await supabase
      .from('planos')
      .select('limite_ia')
      .eq('id', profile.plano)
      .single();

    const mesAtual = new Date().toISOString().substring(0, 7);
    if (profile.uso_ia_mes !== mesAtual) {
      await supabase.from('profiles').update({ 
        uso_ia_mes: mesAtual, 
        uso_ia_quantidade: 0 
      }).eq('id', user.id);
      profile.uso_ia_quantidade = 0;
    }

    if (plano.limite_ia !== 999 && profile.uso_ia_quantidade >= plano.limite_ia) {
      return { 
        statusCode: 429, 
        body: JSON.stringify({ error: 'Limite de IA atingido. Faça upgrade do plano.' }) 
      };
    }

    const keys = {
      groq: process.env.GROQ_API_KEY,
      openai: process.env.OPENAI_API_KEY,
      gemini: process.env.GEMINI_API_KEY,
      grok: process.env.GROK_API_KEY
    };

    const apiKey = keys[provider];
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Provedor não configurado' }) };
    }

    let response;
    
    if (provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: messages.map(m => m.content).join('\n') }] }],
          generationConfig: { temperature: 0.5, maxOutputTokens: max_tokens }
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Erro Gemini');
      
      await supabase.rpc('registrar_uso_ia');
      
      return {
        statusCode: 200,
        body: JSON.stringify({ content: data.candidates[0].content.parts[0].text })
      };
    } else {
      const urls = {
        groq: 'https://api.groq.com/openai/v1/chat/completions',
        openai: 'https://api.openai.com/v1/chat/completions',
        grok: 'https://api.x.ai/v1/chat/completions'
      };
      
      response = await fetch(urls[provider], {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ model, messages, temperature: 0.5, max_tokens })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Erro API');
      
      await supabase.rpc('registrar_uso_ia');
      
      return {
        statusCode: 200,
        body: JSON.stringify({ content: data.choices[0].message.content })
      };
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
