import { HttpErrorResponse } from '@angular/common/http';

const MENSAGENS_POR_CODIGO: Record<string, string> = {
  INVALID_LOGIN_CREDENTIALS: 'E-mail ou senha incorretos.',
  EMAIL_NOT_FOUND: 'E-mail ou senha incorretos.',
  INVALID_PASSWORD: 'E-mail ou senha incorretos.',
  INVALID_EMAIL: 'Informe um e-mail válido.',
  MISSING_PASSWORD: 'Informe a senha.',
  USER_DISABLED: 'Este usuário está desativado. Procure o administrador.',
  TOO_MANY_ATTEMPTS_TRY_LATER: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
};

/**
 * Traduz o erro do Firebase Auth (Identity Toolkit) para uma mensagem em português.
 * O código vem em `error.error.message`, às vezes com detalhe depois de " : ".
 */
export function mensagemDeErroDeLogin(erro: unknown): string {
  if (erro instanceof HttpErrorResponse) {
    if (erro.status === 0) {
      return 'Serviço de autenticação indisponível. Verifique se o emulador do Firebase está no ar.';
    }
    const corpo: unknown = erro.error;
    const codigo =
      corpo && typeof corpo === 'object' && 'error' in corpo
        ? String((corpo as { error?: { message?: unknown } }).error?.message ?? '')
        : '';
    const mensagem = MENSAGENS_POR_CODIGO[codigo.split(' : ')[0]];
    if (mensagem) {
      return mensagem;
    }
  }
  return 'Não foi possível entrar. Tente novamente.';
}
