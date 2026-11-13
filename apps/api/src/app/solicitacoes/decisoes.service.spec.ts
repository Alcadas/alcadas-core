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
const coordenador: AuthenticatedUser = {
  userId: 'marcos',
  tenantId: TENANT_A,
  role: 'APROVADOR_N1',
  level: 'N1',
  maxApprovalLimit: 1000,
};
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

  describe('Integração de Fluxos com Múltiplas Etapas (Issue #66)', () => {
    async function criarSolicitacaoComFluxo(id: string, valor: number, totalEtapas = 2) {
      await firestore.setTenantDocument(TENANT_A, 'requests', id, {
        id,
        tenantId: TENANT_A,
        centroCustoId: 'cc-clinica-centro',
        solicitanteId: 'ana',
        valor,
        categoria: 'SERVICOS_TERCEIROS',
        justificativa: 'Contratação de consultoria especializada de arquitetura',
        status: 'PENDENTE',
        versao: 1,
        fluxoId: 'tier-n2',
        fluxoNome: 'Alçada N2 — Gerência',
        totalEtapas,
        etapaAtual: 1,
        aprovadorEsperadoPapel: 'APROVADOR_N1',
        aprovadorEsperadoNivel: 'N1',
        createdAt: '2026-10-27T10:00:00.000Z',
        updatedAt: '2026-10-27T10:00:00.000Z',
      });
    }

    it('bloqueia aprovador fora da etapa corrente (N2 não aprova etapa 1 que aguarda N1)', async () => {
      await criarSolicitacaoComFluxo('sol-fluxo-1', 2500, 2);

      await expect(service.aprovarSolicitacao(gerente, 'sol-fluxo-1', { versao: 1 })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('avanço de etapa no fluxo (N1 -> N2): N1 aprova -> etapaAtual vira 2 e status continua PENDENTE; N2 aprova -> APROVADA final', async () => {
      await criarSolicitacaoComFluxo('sol-fluxo-2', 2500, 2);

      // 1. Coordenador N1 aprova etapa 1
      const etapa1 = await service.aprovarSolicitacao(coordenador, 'sol-fluxo-2', {
        versao: 1,
        observacao: 'Triagem N1 aprovada',
      });

      expect(etapa1).toMatchObject({
        status: 'PENDENTE',
        versao: 2,
        etapaAtual: 2,
        totalEtapas: 2,
        aprovadorEsperadoPapel: 'APROVADOR_N2',
        aprovadorEsperadoNivel: 'N2',
      });

      const trilha1 = await auditoria.getAuditTrail(TENANT_A, 'sol-fluxo-2');
      expect(trilha1[trilha1.length - 1]).toMatchObject({
        tipoEvento: 'APROVACAO',
        authorId: 'marcos',
      });
      expect(trilha1[trilha1.length - 1].payload).toMatchObject({
        etapaAprovada: 1,
        proximaEtapa: 2,
        aprovadorEsperadoPapel: 'APROVADOR_N2',
        avancoFluxo: true,
      });

      // 2. Gerente N2 agora pode aprovar etapa 2
      const etapa2 = await service.aprovarSolicitacao(gerente, 'sol-fluxo-2', {
        versao: 2,
        observacao: 'Aprovação orçamentária final N2',
      });

      expect(etapa2).toMatchObject({
        status: 'APROVADA',
        versao: 3,
        etapaAtual: 2,
        aprovadorId: 'carlos',
      });

      const trilha2 = await auditoria.getAuditTrail(TENANT_A, 'sol-fluxo-2');
      expect(trilha2[trilha2.length - 1].payload).toMatchObject({
        etapaAprovada: 2,
        aprovacaoFinal: true,
      });
    });

    it('reenvio pelo solicitante após ajuste reseta a esteira para etapaAtual: 1', async () => {
      await criarSolicitacaoComFluxo('sol-fluxo-3', 2500, 2);

      // Coordenador pede ajuste
      await service.solicitarAjuste(coordenador, 'sol-fluxo-3', {
        versao: 1,
        motivo: 'Favor detalhar o escopo da consultoria',
      });

      // Solicitante reenvia
      const reenviada = await service.atualizarOuReenviarSolicitacao(ana, 'sol-fluxo-3', {
        justificativa: 'Consultoria detalhada com 3 propostas e escopo anexo',
      });

      expect(reenviada).toMatchObject({
        status: 'PENDENTE',
        versao: 3,
        etapaAtual: 1,
        aprovadorEsperadoPapel: 'APROVADOR_N1',
        aprovadorEsperadoNivel: 'N1',
      });
    });
  });

  describe('Isolamento de Departamento / Centro de Custo (Cenário 2)', () => {
    const gerenteRH: AuthenticatedUser = {
      userId: 'gestor-rh',
      tenantId: TENANT_A,
      role: 'APROVADOR_N2',
      level: 'N2',
      maxApprovalLimit: 5000,
      costCenterId: 'cc-rh',
      departmentId: 'dep-rh',
    };

    const gerenteTI: AuthenticatedUser = {
      userId: 'gestor-ti',
      tenantId: TENANT_A,
      role: 'APROVADOR_N2',
      level: 'N2',
      maxApprovalLimit: 5000,
      costCenterId: 'cc-ti',
      departmentId: 'dep-ti',
    };

    const diretorCFO: AuthenticatedUser = {
      userId: 'diretor-cfo',
      tenantId: TENANT_A,
      role: 'DIRETOR_CFO',
      level: 'N3',
      maxApprovalLimit: null,
      costCenterId: 'cc-fin',
      departmentId: 'dep-fin',
    };

    const superUserGeral: AuthenticatedUser = {
      userId: 'super-geral',
      tenantId: TENANT_A,
      role: 'SUPER_USER',
      level: 'N3',
      maxApprovalLimit: null,
    };

    async function criarSolicitacaoRH(id: string, valor: number) {
      await firestore.setTenantDocument(TENANT_A, 'requests', id, {
        id,
        tenantId: TENANT_A,
        centroCustoId: 'cc-rh',
        solicitanteId: 'ana-rh',
        valor,
        categoria: 'SERVICOS_TERCEIROS',
        justificativa: 'Consultoria de recrutamento e treinamento para o RH',
        status: 'PENDENTE',
        versao: 1,
        createdAt: '2026-10-27T10:00:00.000Z',
        updatedAt: '2026-10-27T10:00:00.000Z',
      });
    }

    it('aprovador N2 de RH aprova solicitação do centro de custo RH com sucesso', async () => {
      await criarSolicitacaoRH('sol-rh-1', 2500);

      const r = await service.aprovarSolicitacao(gerenteRH, 'sol-rh-1', { versao: 1 });
      expect(r).toMatchObject({
        status: 'APROVADA',
        versao: 2,
        aprovadorId: 'gestor-rh',
      });
    });

    it('aprovador N2 de TI tentando aprovar solicitação do RH é recusado com HTTP 403 Forbidden', async () => {
      await criarSolicitacaoRH('sol-rh-2', 2500);

      await expect(service.aprovarSolicitacao(gerenteTI, 'sol-rh-2', { versao: 1 })).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.aprovarSolicitacao(gerenteTI, 'sol-rh-2', { versao: 1 })).rejects.toThrow(
        /Isolamento de Departamento/,
      );
    });

    it('aprovador N2 de TI tentando rejeitar solicitação do RH é recusado com HTTP 403 Forbidden', async () => {
      await criarSolicitacaoRH('sol-rh-3', 2500);

      await expect(
        service.rejeitarSolicitacao(gerenteTI, 'sol-rh-3', {
          versao: 1,
          motivo: 'Motivo com mais de dez caracteres',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('DIRETOR_CFO aprova solicitação de qualquer centro de custo com sucesso (escopo corporativo)', async () => {
      await criarSolicitacaoRH('sol-rh-4', 2500);

      const r = await service.aprovarSolicitacao(diretorCFO, 'sol-rh-4', { versao: 1 });
      expect(r).toMatchObject({
        status: 'APROVADA',
        versao: 2,
        aprovadorId: 'diretor-cfo',
      });
    });

    it('SUPER_USER aprova solicitação de qualquer centro de custo com sucesso (escopo global)', async () => {
      await criarSolicitacaoRH('sol-rh-5', 2500);

      const r = await service.aprovarSolicitacao(superUserGeral, 'sol-rh-5', { versao: 1 });
      expect(r).toMatchObject({
        status: 'APROVADA',
        versao: 2,
        aprovadorId: 'super-geral',
      });
    });
  });
});
