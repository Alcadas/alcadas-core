import { Injectable, inject } from '@angular/core';
import { NotificacaoService } from '../../../shared/components/notificacao/notificacao.service';
import { SettingsService } from '../../settings/services/settings.service';

const CHAVE = 'alcadas.recuperacao-senha';
/** Validade do código enviado "por e-mail". */
export const VALIDADE_DO_CODIGO_MS = 10 * 60_000;
/** Tentativas erradas antes de exigir um novo código. */
export const MAX_TENTATIVAS = 5;

interface Pendente {
  email: string;
  codigo: string;
  expiraEm: number;
  tentativas: number;
  /** Preenchido quando o código é confirmado; libera a tela de nova senha. */
  token?: string;
}

export type ResultadoVerificacao =
  | { ok: true }
  | { ok: false; erro: string };

/**
 * Recuperação de senha FICTÍCIA para as contas fake do SaaS (sem envio real de e-mail).
 * O código de 6 dígitos é mostrado ao usuário numa notificação na tela, simulando o e-mail.
 * O estado fica no sessionStorage para sobreviver a um recarregamento entre as telas.
 */
@Injectable({ providedIn: 'root' })
export class RecuperacaoSenhaService {
  private readonly settings = inject(SettingsService);
  private readonly notificacoes = inject(NotificacaoService);

  /**
   * Gera um novo código e "envia o e-mail": mostra o código numa notificação na tela.
   * Lança erro se a conta não existir.
   */
  solicitarCodigo(email: string): void {
    const emailLimpo = email.trim().toLowerCase();
    if (!this.settings.findAccountByEmail(emailLimpo)) {
      throw new Error('Não encontramos uma conta com este e-mail.');
    }
    const codigo = gerarCodigo();
    salvar({ email: emailLimpo, codigo, expiraEm: Date.now() + VALIDADE_DO_CODIGO_MS, tentativas: 0 });
    this.notificacoes.mostrar({
      titulo: 'Novo e-mail · Alçadas',
      mensagem: `Seu código de recuperação de senha para ${emailLimpo} é:`,
      destaque: codigo,
    });
  }

  /** Reenvia um código novo para o e-mail que já está em recuperação. */
  reenviarCodigo(): void {
    const pendente = ler();
    if (!pendente) {
      throw new Error('Sessão de recuperação expirada. Informe o e-mail novamente.');
    }
    this.solicitarCodigo(pendente.email);
  }

  /** E-mail em recuperação no momento (ou vazio). */
  emailPendente(): string {
    return ler()?.email ?? '';
  }

  verificarCodigo(codigo: string): ResultadoVerificacao {
    const pendente = ler();
    if (!pendente) {
      return { ok: false, erro: 'Sessão de recuperação expirada. Informe o e-mail novamente.' };
    }
    if (Date.now() > pendente.expiraEm) {
      return { ok: false, erro: 'Código expirado. Peça um novo código.' };
    }
    if (pendente.tentativas >= MAX_TENTATIVAS) {
      return { ok: false, erro: 'Muitas tentativas. Peça um novo código.' };
    }
    if (codigo !== pendente.codigo) {
      salvar({ ...pendente, tentativas: pendente.tentativas + 1 });
      return { ok: false, erro: 'Código inválido. Confira e tente de novo.' };
    }
    salvar({ ...pendente, token: gerarToken() });
    return { ok: true };
  }

  /** True quando o código já foi confirmado e a nova senha pode ser definida. */
  podeRedefinir(): boolean {
    const pendente = ler();
    return !!pendente?.token && Date.now() <= pendente.expiraEm;
  }

  redefinirSenha(novaSenha: string): void {
    const pendente = ler();
    if (!pendente?.token || Date.now() > pendente.expiraEm) {
      throw new Error('Sessão de recuperação expirada. Comece de novo.');
    }
    if (!this.settings.redefinirSenhaPorEmail(pendente.email, novaSenha)) {
      throw new Error('Não encontramos uma conta com este e-mail.');
    }
    salvar(null);
  }

  cancelar(): void {
    salvar(null);
  }
}

function gerarCodigo(): string {
  const n = new Uint32Array(1);
  crypto.getRandomValues(n);
  return String(n[0] % 1_000_000).padStart(6, '0');
}

function gerarToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function ler(): Pendente | null {
  try {
    const bruto = sessionStorage.getItem(CHAVE);
    return bruto ? (JSON.parse(bruto) as Pendente) : null;
  } catch {
    return null;
  }
}

function salvar(valor: Pendente | null): void {
  try {
    if (valor) sessionStorage.setItem(CHAVE, JSON.stringify(valor));
    else sessionStorage.removeItem(CHAVE);
  } catch {
    /* storage indisponível: o fluxo segue só nesta tela */
  }
}
