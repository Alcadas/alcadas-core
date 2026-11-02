/** Papéis com competência para decidir solicitações (ADR-007). Espelha `PAPEIS_APROVADORES` da API. */
export const PAPEIS_APROVADORES: readonly string[] = [
  'USER_NORMAL',
  'SUPER_USER',
  'APROVADOR_N1',
  'APROVADOR_N2',
  'DIRETOR_CFO',
];

export function podeDecidir(papel: string | undefined): boolean {
  return papel !== undefined && PAPEIS_APROVADORES.includes(papel);
}
