import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import * as adminFirestore from 'firebase-admin/firestore';
import { ConflitoDeVersaoError, DocumentoJaExisteError, FirestoreService } from './firestore.service';

jest.mock('firebase-admin/firestore', () => ({ getFirestore: jest.fn() }));
jest.mock('../firebase/firebase-app', () => ({ getFirebaseApp: jest.fn(() => ({})) }));

/** Firestore falso em memória, com o subconjunto do Admin SDK que o serviço usa. */
function criarBancoFalso() {
  const documentos = new Map<string, Record<string, unknown>>();
  let falha: Error | null = null;
  const leituras = { total: 0 };

  const verificar = (): void => {
    if (falha) throw falha;
  };
  const instantaneo = (caminho: string) => ({
    exists: documentos.has(caminho),
    data: () => documentos.get(caminho),
    get: (campo: string) => documentos.get(caminho)?.[campo],
  });
  const referencia = (caminho: string) => ({
    caminho,
    set: jest.fn(async (dados: Record<string, unknown>) => {
      verificar();
      documentos.set(caminho, dados);
    }),
    get: jest.fn(async () => {
      verificar();
      leituras.total++;
      return instantaneo(caminho);
    }),
    create: jest.fn(async (dados: Record<string, unknown>) => {
      verificar();
      if (documentos.has(caminho)) {
        throw Object.assign(new Error('ALREADY_EXISTS'), { code: 6 });
      }
      documentos.set(caminho, dados);
    }),
  });

  const db = {
    doc: jest.fn((caminho: string) => referencia(caminho)),
    collection: jest.fn((prefixo: string) => ({
      get: jest.fn(async () => {
        verificar();
        const docs = [...documentos.entries()]
          .filter(([caminho]) => caminho.startsWith(`${prefixo}/`) && !caminho.slice(prefixo.length + 1).includes('/'))
          .map(([caminho, dados]) => ({ id: caminho.split('/').pop() as string, data: () => dados }));
        return { docs };
      }),
    })),
    runTransaction: jest.fn(async (corpo: (t: unknown) => Promise<unknown>) => {
      verificar();
      return corpo({
        get: async (ref: { caminho: string }) => instantaneo(ref.caminho),
        set: (ref: { caminho: string }, dados: Record<string, unknown>) => documentos.set(ref.caminho, dados),
      });
    }),
  };

  return {
    db,
    documentos,
    leituras,
    derrubar: (erro: Error = Object.assign(new Error('UNAVAILABLE'), { code: 14 })) => {
      falha = erro;
    },
    restaurar: () => {
      falha = null;
    },
  };
}

describe('FirestoreService (Issue #29)', () => {
  const envOriginal = { ...process.env };
  let banco: ReturnType<typeof criarBancoFalso>;
  let servico: FirestoreService;

  beforeEach(() => {
    banco = criarBancoFalso();
    (adminFirestore.getFirestore as jest.Mock).mockReturnValue(banco.db);
    servico = new FirestoreService();
  });

  afterEach(() => {
    process.env = { ...envOriginal };
  });

  describe('em produção — Firestore real via Admin SDK, sem fallback em memória', () => {
    beforeEach(() => {
      process.env['NODE_ENV'] = 'production';
    });

    it('grava no caminho isolado do tenant, sempre com o tenantId e sem campos undefined', async () => {
      const gravado = await servico.setTenantDocument('startop', 'cost_centers', 'cc-101', {
        code: 'CC-101',
        opcional: undefined,
      });

      expect(gravado).toMatchObject({ code: 'CC-101', tenantId: 'startop' });
      expect(banco.documentos.get('tenants/startop/cost_centers/cc-101')).toEqual({
        code: 'CC-101',
        tenantId: 'startop',
      });
    });

    it('os dados sobrevivem a um reinício do processo (nova instância lê o que a anterior gravou)', async () => {
      await servico.setTenantDocument('startop', 'requests', 'sol-1', { valor: 1500, versao: 1 });

      const aposReinicio = new FirestoreService();
      await expect(aposReinicio.getTenantDocument('startop', 'requests', 'sol-1')).resolves.toMatchObject({
        valor: 1500,
      });
      await expect(aposReinicio.listTenantCollection('startop', 'requests')).resolves.toHaveLength(1);
    });

    it('devolve null para documento inexistente e lista vazia para coleção vazia', async () => {
      await expect(servico.getTenantDocument('startop', 'requests', 'nao-existe')).resolves.toBeNull();
      await expect(servico.listTenantCollection('startop', 'requests')).resolves.toEqual([]);
    });

    it('lista apenas os documentos do tenant solicitado', async () => {
      await servico.setTenantDocument('startop', 'requests', 'sol-a', { valor: 1 });
      await servico.setTenantDocument('empresa-b', 'requests', 'sol-b', { valor: 2 });
      banco.documentos.set('tenants/startop/requests/intruso', { valor: 3, tenantId: 'empresa-b' });

      const itens = await servico.listTenantCollection<{ valor: number }>('startop', 'requests');
      expect(itens.map((i) => i.valor)).toEqual([1]);
    });

    it.each([
      ['gravação', (s: FirestoreService) => s.setTenantDocument('startop', 'requests', 'sol-1', { valor: 1 })],
      ['leitura', (s: FirestoreService) => s.getTenantDocument('startop', 'requests', 'sol-1')],
      ['listagem', (s: FirestoreService) => s.listTenantCollection('startop', 'requests')],
      [
        'atualização versionada',
        (s: FirestoreService) => s.updateTenantDocumentIfVersion('startop', 'requests', 'sol-1', 1, { versao: 2 }),
      ],
      [
        'criação exclusiva',
        (s: FirestoreService) => s.createTenantDocumentIfAbsent('startop', 'requests/sol-1/audit_blocks', '1', {}),
      ],
    ])('falha do banco na %s responde 503 em vez de mascarar com memória', async (_caso, operacao) => {
      banco.derrubar();
      await expect(operacao(servico)).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('uma gravação que falhou não fica "salva" em memória', async () => {
      banco.derrubar();
      await expect(servico.setTenantDocument('startop', 'requests', 'sol-1', { valor: 1 })).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );

      banco.restaurar();
      await expect(servico.getTenantDocument('startop', 'requests', 'sol-1')).resolves.toBeNull();
      await expect(servico.listTenantCollection('startop', 'requests')).resolves.toEqual([]);
    });

    it('a resposta 503 não expõe detalhes internos do erro', async () => {
      banco.derrubar(new Error('credencial private_key inválida para conta x@y.iam'));
      const erro = await servico.getTenantDocument('startop', 'requests', 'sol-1').catch((e) => e);
      expect(JSON.stringify((erro as ServiceUnavailableException).getResponse())).not.toMatch(/private_key|iam/);
    });

    it('atualização versionada grava quando a versão confere e acusa conflito quando não confere', async () => {
      await servico.setTenantDocument('startop', 'requests', 'sol-1', { status: 'PENDENTE', versao: 1 });

      await servico.updateTenantDocumentIfVersion('startop', 'requests', 'sol-1', 1, { status: 'APROVADA', versao: 2 });
      expect(banco.documentos.get('tenants/startop/requests/sol-1')).toMatchObject({ status: 'APROVADA', versao: 2 });

      await expect(
        servico.updateTenantDocumentIfVersion('startop', 'requests', 'sol-1', 1, { status: 'REJEITADA', versao: 2 }),
      ).rejects.toBeInstanceOf(ConflitoDeVersaoError);
      expect(banco.documentos.get('tenants/startop/requests/sol-1')).toMatchObject({ status: 'APROVADA' });
    });

    it('criação exclusiva não sobrescreve um elo já gravado', async () => {
      await servico.createTenantDocumentIfAbsent('startop', 'requests/sol-1/audit_blocks', '1', { hash: 'a' });

      await expect(
        servico.createTenantDocumentIfAbsent('startop', 'requests/sol-1/audit_blocks', '1', { hash: 'b' }),
      ).rejects.toBeInstanceOf(DocumentoJaExisteError);
      expect(banco.documentos.get('tenants/startop/requests/sol-1/audit_blocks/1')).toMatchObject({ hash: 'a' });
    });

    describe('ping() usado por /readyz', () => {
      it('consulta o banco real e reaproveita o resultado saudável para poupar cota', async () => {
        await expect(servico.ping()).resolves.toBe(true);
        await expect(servico.ping()).resolves.toBe(true);
        await expect(servico.ping()).resolves.toBe(true);

        expect(banco.leituras.total).toBe(1);
        expect(banco.db.doc).toHaveBeenCalledWith('_health/readyz');
      });

      it('consulta de novo depois que o cache expira', async () => {
        process.env['READYZ_CACHE_TTL_MS'] = '0';
        await servico.ping();
        await servico.ping();
        expect(banco.leituras.total).toBe(2);
      });

      it('devolve false quando o banco está fora e volta a true quando ele retorna', async () => {
        banco.derrubar();
        await expect(servico.ping()).resolves.toBe(false);

        banco.restaurar();
        await expect(servico.ping()).resolves.toBe(true);
      });

      it('uma operação que falha invalida o cache do ping', async () => {
        await expect(servico.ping()).resolves.toBe(true);

        banco.derrubar();
        await servico.getTenantDocument('startop', 'requests', 'sol-1').catch(() => undefined);
        await expect(servico.ping()).resolves.toBe(false);
      });
    });
  });

  describe('fora de produção — emulador indisponível usa o store local', () => {
    beforeEach(() => {
      process.env['NODE_ENV'] = 'test';
      // Porta em que nada escuta: a sonda falha na hora e o Admin SDK nem é chamado.
      process.env['FIRESTORE_EMULATOR_HOST'] = '127.0.0.1:1';
    });

    it('grava, lê e lista pelo store em memória', async () => {
      await servico.setTenantDocument('startop', 'cost_centers', 'cc-1', { code: 'CC-1' });

      await expect(servico.getTenantDocument('startop', 'cost_centers', 'cc-1')).resolves.toMatchObject({ code: 'CC-1' });
      await expect(servico.listTenantCollection('startop', 'cost_centers')).resolves.toHaveLength(1);
      await expect(servico.listTenantCollection('empresa-b', 'cost_centers')).resolves.toEqual([]);
      expect(banco.db.doc).not.toHaveBeenCalled();
    });

    it('mantém concorrência otimista e criação exclusiva no store local', async () => {
      await servico.setTenantDocument('startop', 'requests', 'sol-1', { versao: 1 });
      await servico.updateTenantDocumentIfVersion('startop', 'requests', 'sol-1', 1, { versao: 2 });
      await expect(
        servico.updateTenantDocumentIfVersion('startop', 'requests', 'sol-1', 1, { versao: 2 }),
      ).rejects.toBeInstanceOf(ConflitoDeVersaoError);

      await servico.createTenantDocumentIfAbsent('startop', 'requests/sol-1/audit_blocks', '1', {});
      await expect(
        servico.createTenantDocumentIfAbsent('startop', 'requests/sol-1/audit_blocks', '1', {}),
      ).rejects.toBeInstanceOf(DocumentoJaExisteError);
    });

    it('ping() devolve false sem consumir leituras', async () => {
      await expect(servico.ping()).resolves.toBe(false);
      expect(banco.leituras.total).toBe(0);
    });
  });

  describe('validação de caminho (isolamento — RNF07)', () => {
    it('exige tenantId e recusa separador de caminho no tenantId', async () => {
      await expect(servico.setTenantDocument('', 'requests', 'x', {})).rejects.toThrow(/tenantId é obrigatório/);
      await expect(servico.getTenantDocument('startop/../empresa-b', 'requests', 'x')).rejects.toThrow(/RNF07/);
    });

    it.each(['', 'a/b', '..', '__reservado__'])('recusa o id de documento "%s" com 400', async (docId) => {
      await expect(servico.setTenantDocument('startop', 'requests', docId, {})).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
