/**
 * Tokens de teste com os usuários do seed (`scripts/seed.ts`).
 *
 * Fora de produção, a API aceita JWT sem assinatura e lê as claims do payload; a expiração (`exp`)
 * continua sendo conferida. Em produção esses tokens são recusados (ver `rotas-protegidas-recusa.spec.ts`).
 */
export interface ClaimsTeste {
  uid: string;
  tenantId: string;
  role: string;
  level?: string;
  maxApprovalLimit?: number;
  costCenterId?: string;
}

export function criarToken(claims: ClaimsTeste, expiraEmSegundos = 3600): string {
  const base64 = (obj: object) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const payload = {
    ...claims,
    roles: [claims.role],
    exp: Math.floor(Date.now() / 1000) + expiraEmSegundos,
  };
  return `${base64({ alg: 'none', typ: 'JWT' })}.${base64(payload)}.assinatura`;
}

/** IDs criados pelo seed. */
export const SEED = {
  tenantA: 'startop',
  tenantB: 'empresa-b',
  solicitacaoA: 'sol-startop-01',
  solicitacaoB: 'sol-empresa-b-01',
  centroCustoA: 'cc-startop-01',
  centroCustoA2: 'cc-startop-02',
  centroCustoB: 'cc-empresab-01',
} as const;

export const TOKENS = {
  /** Mesmo usuário do seed, mas com o token vencido há 1 hora. */
  vencido: criarToken({ uid: 'startop-solicitante-01', tenantId: 'startop', role: 'SOLICITANTE' }, -3600),
  malformado: 'isto-nao-e-um-token',

  solicitanteA: criarToken({ uid: 'startop-solicitante-01', tenantId: 'startop', role: 'SOLICITANTE' }),
  adminA: criarToken({ uid: 'startop-admin-01', tenantId: 'startop', role: 'ADMIN' }),
  gerenteA: criarToken({
    uid: 'startop-gerente-01',
    tenantId: 'startop',
    role: 'APROVADOR_N2',
    level: 'N2',
    maxApprovalLimit: 5000,
  }),

  solicitanteB: criarToken({ uid: 'empresab-solicitante-01', tenantId: 'empresa-b', role: 'SOLICITANTE' }),
  adminB: criarToken({ uid: 'empresab-admin-teste', tenantId: 'empresa-b', role: 'ADMIN' }),
  gerenteB: criarToken({
    uid: 'empresab-gerente-teste',
    tenantId: 'empresa-b',
    role: 'APROVADOR_N2',
    level: 'N2',
    maxApprovalLimit: 5000,
  }),

  /** Gerente da startop lotado em outro centro de custo (cc-startop-02). */
  gerenteOutraArea: criarToken({
    uid: 'startop-gerente-ti',
    tenantId: 'startop',
    role: 'APROVADOR_N2',
    level: 'N2',
    maxApprovalLimit: 5000,
    costCenterId: 'cc-startop-02',
  }),
  /** Solicitante da startop lotado em outro centro de custo (cc-startop-02). */
  solicitanteOutraArea: criarToken({
    uid: 'startop-solicitante-ti',
    tenantId: 'startop',
    role: 'SOLICITANTE',
    costCenterId: 'cc-startop-02',
  }),
};
