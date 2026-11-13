import { ValidatorFn, Validators } from '@angular/forms';

/** Regra de senha única do sistema (redefinição e troca em Configurações > Segurança). */
export const TAMANHO_MINIMO_SENHA = 6;

const TEM_LETRA = /[A-Za-z]/;
const TEM_NUMERO = /\d/;

export const DESCRICAO_REGRA_SENHA = `Mínimo ${TAMANHO_MINIMO_SENHA} caracteres, com letras e números.`;

export const validadoresDeSenha: ValidatorFn[] = [
  Validators.required,
  Validators.minLength(TAMANHO_MINIMO_SENHA),
  Validators.pattern(TEM_LETRA),
  Validators.pattern(TEM_NUMERO),
];

export interface RequisitosDaSenha {
  tamanho: boolean;
  letra: boolean;
  numero: boolean;
}

export function requisitosDaSenha(senha: string): RequisitosDaSenha {
  return {
    tamanho: senha.length >= TAMANHO_MINIMO_SENHA,
    letra: TEM_LETRA.test(senha),
    numero: TEM_NUMERO.test(senha),
  };
}
