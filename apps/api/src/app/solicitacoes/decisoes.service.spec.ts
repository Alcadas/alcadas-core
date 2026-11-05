import { ConflictException, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { AuthenticatedUser } from '@alcadas-core/models';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { FirestoreService } from '../database/firestore.service';
import { MaquinaEstadosService } from './maquina-estados.service';
import { DecisoesService } from './decisoes.service';

// Porta sem serviço: o FirestoreService usa o store em memória (teste unitário, sem emulador).
process.env['FIRESTORE_EMULATOR_HOST'] = '127.0.0.1:9';

const TENANT_A = 'startop';
const TENANT_B = 'empresa-b';

const ana: AuthenticatedUser = { userId: 'ana', tenantId: TENANT_A, role: 'SOLICITANTE' };
const gerente: AuthenticatedUser = {
  userId: 'carlos',
  tenantId: TENANT_A,
  role: 'APROVADOR_N2',
  level: 'N2',
  maxApprovalLimit: 5000,
};
const outroGerente: AuthenticatedUser = { ...gerente, userId: 'beatriz' };
const gerenteEmpresaB: AuthenticatedUser = { ...gerente, userId: 'zeca', tenantId: TENANT_B };

describe('DecisoesService — decisões via máquina de estados', () => {
  let firestore: FirestoreService;
  let auditoria: AuditoriaService;
  let service: DecisoesService;

  async function criarSolicitacao(id: string, valor: number, solicitanteId = 'ana') {
    await firestore.setTenantDocument(TENANT_A, 'requests', id, {
      id,
      tenantId: TENANT_A,
      centroCustoId: 'cc-clinica-centro',
      solicitanteId,
      valor,
      categoria: 'SERVICOS_TERCEIROS',
      justificativa: 'Manutenção do aparelho de raio-x da unidade Centro',
      status: 'PENDENTE',
      versao: 1,
      createdAt: '2026-10-27T10:00:00.000Z',
      updatedAt: '2026-10-27T10:00:00.000Z',
    });
  }

  beforeEach(() => {
    firestore = new FirestoreService();
    auditoria = new AuditoriaService(firestore);
    service = new DecisoesService(firestore, auditoria, new MaquinaEstadosService(firestore, auditoria));
  });

  it('T02: gerente aprova R$ 3.200,00 → APROVADA, versão 2 e elo APROVACAO', async () => {
    await criarSolicitacao('sol-1', 3200);

    const r = await service.aprovarSolicitacao(gerente, 'sol-1', { versao: 1 });

    expect(r).toMatchObject({ status: 'APROVADA', versao: 2, aprovadorId: 'carlos' });
    const trilha = await auditoria.getAuditTrail(TENANT_A, 'sol-1');
    expect(trilha[trilha.length - 1]).toMatchObject({ tipoEvento: 'APROVACAO', authorId: 'carlos' });
    expect(trilha[trilha.length - 1].payload).toMatchObject({ transicao: 'T02', de: 'PENDENTE', para: 'APROVADA' });
  });

  it('US-05 / CA-05.1: duas aprovações simultâneas → uma 200 e outra 409', async () => {
    await criarSolicitacao('sol-2', 3200);

    const resultados = await Promise.allSettled([
      service.aprovarSolicitacao(gerente, 'sol-2', { versao: 1 }),
      service.aprovarSolicitacao(outroGerente, 'sol-2', { versao: 1 }),
    ]);

    const ok = resultados.filter((r) => r.status === 'fulfilled');
    const falhas = resultados.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    expect(ok).toHaveLength(1);
    expect(falhas).toHaveLength(1);
    expect(falhas[0].reason).toBeInstanceOf(ConflictException);

    const trilha = await auditoria.getAuditTrail(TENANT_A, 'sol-2');
    expect(trilha.filter((e) => e.tipoEvento === 'APROVACAO')).toHaveLength(1);
  });

  it('N04: versão desatualizada → 409 e estado inalterado', async () => {
    await criarSolicitacao('sol-3', 3200);
    await expect(service.aprovarSolicitacao(gerente, 'sol-3', { versao: 7 })).rejects.toBeInstanceOf(
      ConflictException,
    );
    const atual = await firestore.getTenantDocument<{ status: string }>(TENANT_A, 'requests', 'sol-3');
    expect(atual?.status).toBe('PENDENTE');
  });

  it('CA-03.4: aprovar de novo uma solicitação APROVADA → 409', async () => {
    await criarSolicitacao('sol-4', 3200);
    await service.aprovarSolicitacao(gerente, 'sol-4', { versao: 1 });
    await expect(service.aprovarSolicitacao(gerente, 'sol-4', { versao: 2 })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('CA-03.1: valor acima do teto (R$ 7.500,00) → 403 e continua PENDENTE', async () => {
    await criarSolicitacao('sol-5', 7500);
    await expect(service.aprovarSolicitacao(gerente, 'sol-5', { versao: 1 })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    const atual = await firestore.getTenantDocument<{ status: string }>(TENANT_A, 'requests', 'sol-5');
    expect(atual?.status).toBe('PENDENTE');
  });

  it('CA-04.1 / CA-04.3: autor tenta aprovar o próprio pedido → 403 e registro BLOQUEIO_SOD', async () => {
    await criarSolicitacao('sol-6', 3200, 'carlos');
    await expect(service.aprovarSolicitacao(gerente, 'sol-6', { versao: 1 })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    const trilha = await auditoria.getAuditTrail(TENANT_A, 'sol-6');
    expect(trilha.map((e) => e.tipoEvento)).toEqual(['BLOQUEIO_SOD']);
  });

  it('US-09: papel sem competência (SOLICITANTE) → 403', async () => {
    await criarSolicitacao('sol-7', 100, 'outra-pessoa');
    await expect(service.aprovarSolicitacao(ana, 'sol-7', { versao: 1 })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('CA-16.1: gerente da empresa B não enxerga solicitação da empresa A → 404', async () => {
    await criarSolicitacao('sol-8', 3200);
    await expect(service.aprovarSolicitacao(gerenteEmpresaB, 'sol-8', { versao: 1 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it.each([
    ['Sem verba', false],
    ['Fora do orçamento', true],
  ])('CA-03.2: rejeitar com motivo "%s" → aceito=%s', async (motivo, aceito) => {
    await criarSolicitacao('sol-9', 3200);
    const chamada = service.rejeitarSolicitacao(gerente, 'sol-9', { versao: 1, motivo });
    if (aceito) {
      await expect(chamada).resolves.toMatchObject({ status: 'REJEITADA', motivoDecisao: motivo });
    } else {
      await expect(chamada).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('T04: pedir ajuste → EM_AJUSTE; aprovar a partir de EM_AJUSTE → 409', async () => {
    await criarSolicitacao('sol-10', 3200);
    const r = await service.solicitarAjuste(gerente, 'sol-10', {
      versao: 1,
      motivo: 'Anexar os três orçamentos comparativos',
    });
    expect(r.status).toBe('EM_AJUSTE');
    await expect(service.aprovarSolicitacao(gerente, 'sol-10', { versao: 2 })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  describe('trilha', () => {
    it('US-08: verificação íntegra após decisões e acesso do solicitante ao próprio pedido', async () => {
      await criarSolicitacao('sol-11', 3200);
      await service.solicitarAjuste(gerente, 'sol-11', { versao: 1, motivo: 'Corrigir o centro de custo' });

      await expect(service.verificarTrilha(ana, 'sol-11')).resolves.toMatchObject({
        status: 'INTEGRA',
        totalElos: 1,
      });
      await expect(service.obterTrilha(gerente, 'sol-11')).resolves.toHaveLength(1);
    });

    it('solicitante não lê a trilha do pedido de outra pessoa → 403', async () => {
      await criarSolicitacao('sol-12', 3200, 'outra-pessoa');
      await expect(service.obterTrilha(ana, 'sol-12')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('trilha de solicitação de outro tenant → 404', async () => {
      await criarSolicitacao('sol-13', 3200);
      await expect(service.obterTrilha(gerenteEmpresaB, 'sol-13')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
