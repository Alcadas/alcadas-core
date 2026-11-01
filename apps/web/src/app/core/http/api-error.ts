import { HttpErrorResponse } from '@angular/common/http';

const MENSAGEM_PADRAO = 'Não foi possível concluir a operação. Tente novamente.';
const MENSAGEM_SEM_CONEXAO = 'Não foi possível conectar à API. Verifique se ela está no ar e tente novamente.';

/**
 * Extrai a mensagem do corpo de erro padronizado da API (`ErrorResponse` do OpenAPI v0.2)
 * para mostrar ao usuário.
 */
export function mensagemDeErroDaApi(erro: unknown): string {
  if (!(erro instanceof HttpErrorResponse)) {
    return MENSAGEM_PADRAO;
  }
  if (erro.status === 0) {
    return MENSAGEM_SEM_CONEXAO;
  }
  const corpo: unknown = erro.error;
  if (corpo && typeof corpo === 'object' && 'message' in corpo) {
    const mensagem = (corpo as { message: unknown }).message;
    if (typeof mensagem === 'string' && mensagem.trim()) {
      return mensagem;
    }
    if (Array.isArray(mensagem) && mensagem.length > 0) {
      return mensagem.join('; ');
    }
  }
  return MENSAGEM_PADRAO;
}
