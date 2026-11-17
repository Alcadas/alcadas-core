import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import axios, { AxiosInstance } from 'axios';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { configurarApp } from '../common/configurar-app';
import { FirestoreService } from '../database/firestore.service';
import { AlcadasService } from './alcadas.service';
import { ProvisionamentoColaboradoresService } from './provisionamento-colaboradores.service';
import { SaasController } from './saas.controller';

/**
 * Testes de autorização das rotas administrativas `saas/tenants` (Issue #28).
 *
 * Sobem o controller real, com os guards reais, atrás de HTTP. Os tokens usam o formato de teste
 * `test:<tenantId>:<papel>:<userId>`, aceito pelo `JwtAuthGuard` somente quando `NODE_ENV=test`.
 */
describe('RBAC e isolamento multi-tenant em saas/tenants (Issue #28)', () => {
  let app: INestApplication;
  let http: AxiosInstance;
  let banco: Map<string, Record<string, unknown>>;
  let sincronizar: jest.Mock;
  const envOriginal = process.env['NODE_ENV'];

  const token = (tenantId: string, papel: string): { Authorization: string } => ({
    Authorization: `Bearer test:${tenantId}:${papel}:usr-${tenantId}-${papel.toLowerCase()}`,
  });
  const SUPER_ADMIN = token('platform-saas', 'SUPER_USER');
  const ADMIN_STARTOP = token('startop', 'ADMIN');
  const ADMIN_EMPRESA_B = token('empresa-b', 'ADMIN');

  const empresa = (tenantId: string, extras: Record<string, unknown> = {}) => ({
    tenantId,
    plan: 'ENTERPRISE',
    status: 'ATIVO',
    createdAt: '2026-01-01T00:00:00.000Z',
    maxUsers: 50,
    ownerName: `Dono ${tenantId}`,
    ownerEmail: `dono@${tenantId}.test`,
    ownerRole: 'ADMIN',
    organization: {
      legalName: `Razão Social ${tenantId}`,
      departments: [],
      employees: [
        { id: 'emp-1', fullName: 'Colaborador Um', email: `um@${tenantId}.test`, role: 'GERENTE', password: 'segredo123' },
      ],
    },
    profissoes: [],
    ...extras,
  });

  const chave = (tenantId: string, colecao: string, id: string) => `${tenantId}/${colecao}/${id}`;

  beforeAll(async () => {
    process.env['NODE_ENV'] = 'test';

    // Firestore em memória, com o mesmo contrato de isolamento por tenant do serviço real.
    const firestore: Partial<FirestoreService> = {
      setTenantDocument: jest.fn(async (tenantId: string, colecao: string, id: string, dados: object) => {
        banco.set(chave(tenantId, colecao, id), dados as Record<string, unknown>);
        return dados as never;
      }),
      getTenantDocument: jest.fn(
        async (tenantId: string, colecao: string, id: string) =>
          (banco.get(chave(tenantId, colecao, id)) as never) ?? null,
      ),
      listTenantCollection: jest.fn(async (tenantId: string, colecao: string) =>
        [...banco.entries()]
          .filter(([caminho]) => caminho.startsWith(`${tenantId}/${colecao}/`))
          .map(([, dados]) => dados as never),
      ),
    };
    sincronizar = jest.fn().mockResolvedValue(undefined);

    const modulo = await Test.createTestingModule({
      controllers: [SaasController],
      providers: [
        JwtAuthGuard,
        RolesGuard,
        { provide: FirestoreService, useValue: firestore },
        {
          provide: AlcadasService,
          useValue: {
            getApprovalTiers: jest.fn().mockResolvedValue([{ level: 'N1' }]),
            upsertApprovalTiers: jest.fn(),
          },
        },
        { provide: ProvisionamentoColaboradoresService, useValue: { sincronizar } },
      ],
    }).compile();

    app = modulo.createNestApplication();
    configurarApp(app, { escreverLog: () => undefined });
    await app.listen(0);
    const endereco = app.getHttpServer().address() as { port: number };
    http = axios.create({ baseURL: `http://127.0.0.1:${endereco.port}/api`, validateStatus: () => true });
  });

  beforeEach(() => {
    banco = new Map();
    banco.set(chave('platform-saas', 'saas_tenants', 'startop'), empresa('startop'));
    banco.set(chave('platform-saas', 'saas_tenants', 'empresa-b'), empresa('empresa-b', { plan: 'PRO', maxUsers: 10 }));
    banco.set(chave('startop', 'workflows', 'wf-a'), { id: 'wf-a', nome: 'Fluxo da Startop' });
    banco.set(chave('empresa-b', 'workflows', 'wf-b'), { id: 'wf-b', nome: 'Fluxo da Empresa B' });
    sincronizar.mockClear();
  });

  afterAll(async () => {
    process.env['NODE_ENV'] = envOriginal;
    await app.close();
  });

  const rotasAdministrativas: Array<[string, string]> = [
    ['GET', '/saas/tenants'],
    ['PUT', '/saas/tenants/startop'],
    ['POST', '/saas/tenants/sync'],
  ];

  describe('Cenário 1 — sem token', () => {
    it.each(rotasAdministrativas)('%s %s responde 401 Unauthorized', async (method, url) => {
      const res = await http.request({ method, url, data: {} });
      expect(res.status).toBe(401);
      expect(res.data).toMatchObject({ statusCode: 401 });
    });

    it('token malformado também responde 401', async () => {
      const res = await http.get('/saas/tenants', { headers: { Authorization: 'Bearer token-qualquer' } });
      expect(res.status).toBe(401);
    });
  });

  describe('Cenário 2 — papel incorreto', () => {
    const papeisComuns = ['SOLICITANTE', 'APROVADOR_N1', 'APROVADOR_N2', 'DIRETOR_CFO', 'AUDITOR', 'ADMIN'];

    it.each(papeisComuns)('GET /saas/tenants com papel %s responde 403 Forbidden', async (papel) => {
      const res = await http.get('/saas/tenants', { headers: token('startop', papel) });
      expect(res.status).toBe(403);
      expect(res.data).toMatchObject({ statusCode: 403 });
      expect(JSON.stringify(res.data)).not.toContain('empresa-b');
    });

    it.each(papeisComuns)('POST /saas/tenants/sync com papel %s responde 403 e não grava', async (papel) => {
      const antes = banco.size;
      const res = await http.post(
        '/saas/tenants/sync',
        { tenants: [empresa('invasora')] },
        { headers: token('startop', papel) },
      );
      expect(res.status).toBe(403);
      expect(banco.size).toBe(antes);
    });

    it.each(papeisComuns.filter((p) => p !== 'ADMIN'))(
      'PUT /saas/tenants/startop com papel %s da própria empresa responde 403',
      async (papel) => {
        const res = await http.put('/saas/tenants/startop', empresa('startop', { plan: 'FREE' }), {
          headers: token('startop', papel),
        });
        expect(res.status).toBe(403);
        expect(banco.get(chave('platform-saas', 'saas_tenants', 'startop'))).toMatchObject({ plan: 'ENTERPRISE' });
      },
    );

    it('cabeçalho x-user-role não eleva o papel do token', async () => {
      const res = await http.get('/saas/tenants', {
        headers: { ...token('startop', 'SOLICITANTE'), 'x-user-role': 'SUPER_USER' },
      });
      expect(res.status).toBe(403);
    });
  });

  describe('Cenário 3 — isolamento entre empresas', () => {
    it('ADMIN de uma empresa não altera os dados de outra (403, nada gravado nem provisionado)', async () => {
      const original = banco.get(chave('platform-saas', 'saas_tenants', 'startop'));
      const res = await http.put(
        '/saas/tenants/startop',
        empresa('startop', { ownerName: 'Invasor', ownerEmail: 'invasor@empresa-b.test' }),
        { headers: ADMIN_EMPRESA_B },
      );

      expect(res.status).toBe(403);
      expect(banco.get(chave('platform-saas', 'saas_tenants', 'startop'))).toBe(original);
      expect(banco.has(chave('startop', 'organization', 'config'))).toBe(false);
      expect(sincronizar).not.toHaveBeenCalled();
    });

    it('ADMIN não consegue se apontar para outra empresa pelo corpo da requisição', async () => {
      const res = await http.put('/saas/tenants/empresa-b', empresa('startop'), { headers: ADMIN_STARTOP });
      expect(res.status).toBe(403);
    });

    it('ADMIN não lê a lista de empresas, portanto não enxerga dados de outra empresa', async () => {
      const res = await http.get('/saas/tenants', { headers: ADMIN_EMPRESA_B });
      expect(res.status).toBe(403);
      expect(JSON.stringify(res.data)).not.toContain('startop');
    });

    it('fluxos da organização vêm sempre do tenant do token, mesmo com cabeçalho adulterado', async () => {
      const res = await http.get('/organizacao/fluxos', {
        headers: { ...token('empresa-b', 'SOLICITANTE'), 'x-tenant-id': 'startop' },
      });

      expect(res.status).toBe(200);
      expect(res.data.workflows).toEqual([{ id: 'wf-b', nome: 'Fluxo da Empresa B' }]);
      expect(JSON.stringify(res.data)).not.toContain('Startop');
    });

    it('ADMIN atualiza a própria empresa, mas plano, situação e limites continuam os da plataforma', async () => {
      const res = await http.put(
        '/saas/tenants/startop',
        empresa('startop', { plan: 'UNLIMITED', status: 'VIP', maxUsers: 99999, ownerName: 'Novo Dono' }),
        { headers: ADMIN_STARTOP },
      );

      expect(res.status).toBe(200);
      const gravado = banco.get(chave('platform-saas', 'saas_tenants', 'startop'));
      expect(gravado).toMatchObject({ plan: 'ENTERPRISE', status: 'ATIVO', maxUsers: 50, ownerName: 'Novo Dono' });
      expect(banco.get(chave('startop', 'organization', 'config'))).toMatchObject({ plan: 'ENTERPRISE' });
      expect(sincronizar).toHaveBeenCalledWith('startop', expect.any(Array), []);
    });

    it('ADMIN não cria empresa que a plataforma ainda não cadastrou (404)', async () => {
      banco.delete(chave('platform-saas', 'saas_tenants', 'startop'));
      const res = await http.put('/saas/tenants/startop', empresa('startop'), { headers: ADMIN_STARTOP });
      expect(res.status).toBe(404);
    });
  });

  describe('Super Admin da plataforma (SUPER_USER)', () => {
    it('lista todas as empresas', async () => {
      const res = await http.get('/saas/tenants', { headers: SUPER_ADMIN });
      expect(res.status).toBe(200);
      expect(res.data.items.map((t: { tenantId: string }) => t.tenantId).sort()).toEqual(['empresa-b', 'startop']);
    });

    it('cria/atualiza qualquer empresa, inclusive plano e situação', async () => {
      const res = await http.put('/saas/tenants/empresa-c', empresa('empresa-c', { plan: 'PRO' }), {
        headers: SUPER_ADMIN,
      });
      expect(res.status).toBe(200);
      expect(banco.get(chave('platform-saas', 'saas_tenants', 'empresa-c'))).toMatchObject({ plan: 'PRO' });
    });

    it('sincroniza um lote de empresas', async () => {
      const res = await http.post(
        '/saas/tenants/sync',
        { tenants: [empresa('empresa-c'), empresa('empresa-d')] },
        { headers: SUPER_ADMIN },
      );
      expect(res.status).toBe(200);
      expect(res.data).toEqual({ synced: 2 });
    });

    it.each(['platform-saas', 'tenant%2Finvalido', 'a b'])(
      'recusa tenantId reservado ou inválido (%s) com 400',
      async (tenantId) => {
        const res = await http.put(`/saas/tenants/${tenantId}`, empresa('x'), { headers: SUPER_ADMIN });
        expect(res.status).toBe(400);
      },
    );
  });

  describe('Senhas de colaboradores (RNF09)', () => {
    it('em produção não são persistidas no Firestore nem devolvidas na resposta', async () => {
      // O token é validado antes da troca de ambiente porque `test:` só vale com NODE_ENV=test;
      // aqui o guard de autenticação é exercitado via método direto do controller.
      const controller = app.get(SaasController);
      process.env['NODE_ENV'] = 'production';
      try {
        const resposta = await controller.upsertSaasTenant(
          { userId: 'root', tenantId: 'platform-saas', role: 'SUPER_USER' },
          'startop',
          empresa('startop') as never,
        );
        const gravado = JSON.stringify(banco.get(chave('platform-saas', 'saas_tenants', 'startop')));
        expect(gravado).not.toContain('segredo123');
        expect(JSON.stringify(banco.get(chave('startop', 'organization', 'config')))).not.toContain('segredo123');
        expect(JSON.stringify(resposta)).not.toContain('segredo123');
      } finally {
        process.env['NODE_ENV'] = 'test';
      }
    });
  });
});
