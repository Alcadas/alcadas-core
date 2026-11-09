import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import * as adminAuth from 'firebase-admin/auth';
import { JwtAuthGuard } from './jwt-auth.guard';

jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(),
}));

function mockContext(headers: Record<string, string | undefined>): {
  context: ExecutionContext;
  req: { headers: Record<string, string | undefined>; user?: unknown };
} {
  const req = { headers, user: undefined };
  const context = {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as unknown as ExecutionContext;
  return { context, req };
}

describe('JwtAuthGuard (Hardening de Segurança e Assinatura Criptográfica - Issue #27)', () => {
  let guard: JwtAuthGuard;
  const originalEnv = process.env['NODE_ENV'];
  let verifyIdTokenMock: jest.Mock;

  beforeEach(() => {
    guard = new JwtAuthGuard();
    verifyIdTokenMock = jest.fn();
    (adminAuth.getAuth as jest.Mock).mockReturnValue({
      verifyIdToken: verifyIdTokenMock,
    });
  });

  afterEach(() => {
    process.env['NODE_ENV'] = originalEnv;
    jest.clearAllMocks();
  });

  describe('Validação de cabeçalho Authorization', () => {
    it('recusa requisição sem cabeçalho Authorization', async () => {
      const { context } = mockContext({});
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('recusa cabeçalho que não inicia com Bearer', async () => {
      const { context } = mockContext({ authorization: 'Basic 123456' });
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('recusa token Bearer vazio', async () => {
      const { context } = mockContext({ authorization: 'Bearer    ' });
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('Ambiente de Produção (NODE_ENV=production)', () => {
    beforeEach(() => {
      process.env['NODE_ENV'] = 'production';
    });

    it('aceita token com assinatura válida verificada pelo Firebase Admin SDK', async () => {
      verifyIdTokenMock.mockResolvedValue({
        uid: 'usr-aprov-n2',
        tenantId: 'startop',
        email: 'gerente@startop.com',
        name: 'Gerente Startop',
        role: 'APROVADOR_N2',
        level: 'N2',
        limiteAlcada: 5000,
      });

      const { context, req } = mockContext({
        authorization: 'Bearer token-real-assinado-pelo-firebase',
      });

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(verifyIdTokenMock).toHaveBeenCalledWith('token-real-assinado-pelo-firebase');
      expect(req.user).toEqual({
        userId: 'usr-aprov-n2',
        tenantId: 'startop',
        email: 'gerente@startop.com',
        fullName: 'Gerente Startop',
        role: 'APROVADOR_N2',
        level: 'N2',
        maxApprovalLimit: 5000,
      });
    });

    it('ignora estritamente cabeçalhos de privilégio como x-user-role e x-approval-limit em produção', async () => {
      verifyIdTokenMock.mockResolvedValue({
        uid: 'usr-solicitante',
        tenantId: 'startop',
        role: 'SOLICITANTE',
      });

      const { context, req } = mockContext({
        authorization: 'Bearer token-real-solicitante',
        'x-user-role': 'DIRETOR_CFO', // Tentativa de injeção de privilégio
        'x-approval-limit': '99999999',
        'x-tenant-id': 'tenant-adulterado',
      });

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      // Assegura que o papel atribuído veio da claim criptografada, não do header
      expect(req.user).toMatchObject({
        userId: 'usr-solicitante',
        tenantId: 'startop',
        role: 'SOLICITANTE',
        maxApprovalLimit: undefined,
      });
    });

    it('recusa token forjado com prefixo test: em produção com 401', async () => {
      verifyIdTokenMock.mockRejectedValue(new Error('Firebase ID token has invalid format'));

      const { context } = mockContext({
        authorization: 'Bearer test:startop:DIRETOR_CFO:hacker-01:999999',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('recusa token mock de frontend (mock-jwt-token-alcadas-) em produção com 401', async () => {
      verifyIdTokenMock.mockRejectedValue(new Error('Invalid token structure'));

      const { context } = mockContext({
        authorization: 'Bearer mock-jwt-token-alcadas-1',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('recusa token sem assinatura (alg: none) em produção com 401', async () => {
      verifyIdTokenMock.mockRejectedValue(new Error('Firebase ID token has invalid signature'));

      const h = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const b = Buffer.from(
        JSON.stringify({ uid: 'usr-hacker', tenantId: 'startop', role: 'DIRETOR_CFO' }),
      ).toString('base64url');
      const token = `${h}.${b}.`;

      const { context } = mockContext({ authorization: `Bearer ${token}` });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('recusa token com assinatura inválida/corrompida em produção com 401', async () => {
      verifyIdTokenMock.mockRejectedValue(new Error('Firebase ID token has invalid signature'));

      const { context } = mockContext({
        authorization: 'Bearer header.payload.assinaturainvalida',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('recusa token com claims essenciais ausentes (sem tenantId) em produção com 401', async () => {
      verifyIdTokenMock.mockResolvedValue({
        uid: 'usr-sem-tenant',
        role: 'SOLICITANTE',
        // tenantId ausente
      });

      const { context } = mockContext({
        authorization: 'Bearer token-sem-tenant',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('Ambiente de Testes (NODE_ENV=test)', () => {
    beforeEach(() => {
      process.env['NODE_ENV'] = 'test';
    });

    it('aceita token estruturado test: com tenant, papel, id e limite', async () => {
      const { context, req } = mockContext({
        authorization: 'Bearer test:startop:APROVADOR_N1:usr-coord-01:1000',
      });

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(req.user).toEqual({
        userId: 'usr-coord-01',
        tenantId: 'startop',
        role: 'APROVADOR_N1',
        level: 'N1',
        maxApprovalLimit: 1000,
      });
    });

    it('aceita token JWT padrão sem validação remota caso verifyIdToken falhe no ambiente de teste offline', async () => {
      verifyIdTokenMock.mockRejectedValue(new Error('Emulador offline'));

      const h = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const b = Buffer.from(
        JSON.stringify({
          uid: 'usr-dev-local',
          tenantId: 'startop',
          role: 'APROVADOR_N2',
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      ).toString('base64url');
      const token = `${h}.${b}.sig`;

      const { context, req } = mockContext({ authorization: `Bearer ${token}` });

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(req.user).toMatchObject({
        userId: 'usr-dev-local',
        tenantId: 'startop',
        role: 'APROVADOR_N2',
      });
    });

    it('recusa token JWT com expiração vencida mesmo em ambiente de teste', async () => {
      verifyIdTokenMock.mockRejectedValue(new Error('Emulador offline'));

      const h = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const b = Buffer.from(
        JSON.stringify({
          uid: 'usr-expirado',
          tenantId: 'startop',
          exp: Math.floor(Date.now() / 1000) - 3600, // expirou há 1 hora
        }),
      ).toString('base64url');
      const token = `${h}.${b}.sig`;

      const { context } = mockContext({ authorization: `Bearer ${token}` });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });
  });
});
