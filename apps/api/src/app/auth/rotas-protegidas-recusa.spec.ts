import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import axios, { AxiosInstance } from 'axios';
import * as adminAuth from 'firebase-admin/auth';
import { AlcadasController } from '../alcadas/alcadas.controller';
import { AlcadasService } from '../alcadas/alcadas.service';
import { SaasController } from '../alcadas/saas.controller';
import { FirestoreService } from '../database/firestore.service';
import { DecisoesController } from '../solicitacoes/decisoes.controller';
import { DecisoesService } from '../solicitacoes/decisoes.service';
import { ListagemValidator } from '../solicitacoes/listagem.validator';
import { SolicitacoesController } from '../solicitacoes/solicitacoes.controller';
import { SolicitacoesService } from '../solicitacoes/solicitacoes.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { FirebaseAuthGuard } from './firebase-auth.guard';

jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(),
}));

describe('Recusa de Tokens Forjados em Rotas Protegidas (Issue #27 / RNF09 - NODE_ENV=production)', () => {
  let app: INestApplication;
  let http: AxiosInstance;
  const originalEnv = process.env['NODE_ENV'];
  let verifyIdTokenMock: jest.Mock;

  const jwtSemAssinatura = (() => {
    const h = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const b = Buffer.from(
      JSON.stringify({ uid: 'hacker', tenantId: 'startop', role: 'DIRETOR_CFO' }),
    ).toString('base64url');
    return `${h}.${b}.`;
  })();

  const jwtAssinaturaInvalida = (() => {
    const h = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const b = Buffer.from(
      JSON.stringify({ uid: 'hacker', tenantId: 'startop', role: 'DIRETOR_CFO' }),
    ).toString('base64url');
    return `${h}.${b}.assinaturafalsa123`;
  })();

  const forjados: Array<[string, string]> = [
    ['test:startop:DIRETOR_CFO:x', 'token com prefixo test:'],
    ['mock-jwt-token-alcadas-1', 'token mock de frontend'],
    [jwtSemAssinatura, 'token sem assinatura (alg: none)'],
    [jwtAssinaturaInvalida, 'token com assinatura inválida'],
    ['token-do-usuario-da-empresa-A', 'token legado de teste E2E'],
  ];

  // Matriz de todas as rotas protegidas da API
  const rotasProtegidas: Array<[string, string]> = [
    // 1. SolicitacoesController (Jornada 2)
    ['POST', '/solicitacoes'],
    ['GET', '/solicitacoes'],

    // 2. DecisoesController (Jornadas 3 e 5)
    ['POST', '/solicitacoes/sol-001/aprovar'],
    ['POST', '/solicitacoes/sol-001/rejeitar'],
    ['POST', '/solicitacoes/sol-001/ajuste'],
    ['PUT', '/solicitacoes/sol-001'],
    ['GET', '/solicitacoes/sol-001/trilha'],
    ['POST', '/solicitacoes/sol-001/trilha/verificar'],

    // 3. AlcadasController (Jornada 1 e Governança)
    ['POST', '/centros-custo'],
    ['GET', '/centros-custo'],
    ['POST', '/tenants/startop/cost-centers'],
    ['GET', '/tenants/startop/cost-centers'],
    ['PUT', '/alcadas/tetos'],
    ['POST', '/alcadas/tetos'],
    ['GET', '/alcadas/tetos'],
    ['PUT', '/tenants/startop/tiers'],
    ['GET', '/tenants/startop/tiers'],
    ['POST', '/alcadas/validar-decisao'],

    // 4. SaasController (Configurações e Governança Multi-Tenant)
    ['GET', '/organizacao/fluxos'],
    ['PUT', '/organizacao/fluxos'],
    ['GET', '/saas/tenants'],
    ['PUT', '/saas/tenants/startop'],
    ['POST', '/saas/tenants/sync'],
  ];

  beforeAll(async () => {
    process.env['NODE_ENV'] = 'production';

    verifyIdTokenMock = jest.fn().mockRejectedValue(
      new Error('Firebase ID token has invalid signature or format'),
    );
    (adminAuth.getAuth as jest.Mock).mockReturnValue({
      verifyIdToken: verifyIdTokenMock,
    });

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [
        SolicitacoesController,
        DecisoesController,
        AlcadasController,
        SaasController,
      ],
      providers: [
        JwtAuthGuard,
        RolesGuard,
        FirebaseAuthGuard,
        {
          provide: SolicitacoesService,
          useValue: {
            criarSolicitacao: jest.fn(),
            listarPorTenant: jest.fn(),
          },
        },
        {
          provide: DecisoesService,
          useValue: {
            aprovarSolicitacao: jest.fn(),
            rejeitarSolicitacao: jest.fn(),
            solicitarAjuste: jest.fn(),
            atualizarOuReenviarSolicitacao: jest.fn(),
            obterTrilhaAuditoria: jest.fn(),
            verificarTrilhaAuditoria: jest.fn(),
          },
        },
        {
          provide: AlcadasService,
          useValue: {
            assertTenantIsolation: jest.fn().mockReturnValue('startop'),
            createCostCenter: jest.fn(),
            listCostCenters: jest.fn(),
            upsertApprovalTiers: jest.fn(),
            getApprovalTiers: jest.fn(),
            evaluateDecisionCompetence: jest.fn(),
          },
        },
        {
          provide: FirestoreService,
          useValue: {
            listTenantCollection: jest.fn().mockResolvedValue([]),
            setTenantDocument: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: ListagemValidator,
          useValue: {
            validar: jest.fn().mockReturnValue({ page: 1, limit: 10 }),
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    await app.listen(0);

    const address = app.getHttpServer().address();
    const port = typeof address === 'string' ? address : address?.port;
    http = axios.create({
      baseURL: `http://127.0.0.1:${port}`,
      validateStatus: () => true,
    });
  });

  afterAll(async () => {
    process.env['NODE_ENV'] = originalEnv;
    await app.close();
  });

  describe.each(rotasProtegidas)('Rota Protegida: %s %s', (metodo, rota) => {
    it.each(forjados)('recusa %s com HTTP 401 Unauthorized', async (token) => {
      const res = await http.request({
        method: metodo,
        url: rota,
        headers: {
          Authorization: `Bearer ${token}`,
          'x-user-role': 'DIRETOR_CFO', // Injeção de privilégio deve ser ignorada
        },
        data: {},
      });

      expect(res.status).toBe(401);
      expect(res.data).toMatchObject({
        statusCode: 401,
      });
    });

    it('recusa requisição sem cabeçalho Authorization com HTTP 401', async () => {
      const res = await http.request({
        method: metodo,
        url: rota,
        data: {},
      });

      expect(res.status).toBe(401);
    });
  });
});
