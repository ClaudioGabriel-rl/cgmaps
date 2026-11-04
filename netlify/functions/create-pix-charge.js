  } catch (error) {
    console.error('💥 ERRO FATAL:', error.message);
    
    // Retorna TODOS os detalhes na resposta para o navegador ver
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Erro no servidor', 
        details: error.message,
        stack: error.stack, // Mostra a linha exata do erro
        timestamp: new Date().toISOString()
      })
    };
  }
