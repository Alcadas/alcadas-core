import { MODELOS_REGRAS_ALCADA } from '@alcadas-core/models';
import {
  avaliarSolicitacaoNoFluxo,
  buildWorkflowNodesFromFaixas,
  buildWorkflowNodesFromModelo,
  calculateCeilingFromNodes,
  extractStepsFromNodes,
  formatCurrencyBRL,
  mapModeloToLimitRule,
} from './limits-workflow.utils';
import { LimitRuleItem } from '../limits.models';

describe('limits-workflow.utils', () => {
  const modeloReembolso = MODELOS_REGRAS_ALCADA.find(
    (m) => m.id === 'reembolso-despesas-operacionais',
  )!;
  const modeloTi = MODELOS_REGRAS_ALCADA.find((m) => m.id === 'aquisicao-equipamentos-ti')!;

  it('deve formatar valores em reais corretamente', () => {
    expect(formatCurrencyBRL(500)).toContain('500');
    expect(formatCurrencyBRL(1500.5)).toContain('1.500,50');
  });

  it('deve gerar esteira sequencial completa a partir das faixas', () => {
    const nodes = buildWorkflowNodesFromFaixas(modeloReembolso.faixas, {
      ruleTitle: modeloReembolso.nome,
      costCenter: modeloReembolso.centroCustoSugerido,
      quorum: modeloReembolso.quorum,
      slaHours: modeloReembolso.slaHoras,
    });

    // 1 TRIGGER + 1 RISK_CHECK + 3 faixas * 2 nós (COND + APP) + 1 SLA + 1 TERMINAL = 10 nós
    expect(nodes.length).toBe(10);
    expect(nodes[0].type).toBe('TRIGGER');
    expect(nodes[1].type).toBe('RISK_CHECK');

    // Primeira faixa: 0 a 500 -> COORDENADOR
    expect(nodes[2].type).toBe('CONDITION_VALUE');
    expect(nodes[2].config.valueMax).toBe(500);
    expect(nodes[3].type).toBe('APPROVER');
    expect(nodes[3].config.approverRole).toBe('COORDENADOR');

    // Segunda faixa: 500.01 a 2000 -> GERENTE
    expect(nodes[4].type).toBe('CONDITION_VALUE');
    expect(nodes[4].config.valueMax).toBe(2000);
    expect(nodes[5].type).toBe('APPROVER');
    expect(nodes[5].config.approverRole).toBe('GERENTE');

    // Terceira faixa: sem limite -> DIRETOR
    expect(nodes[6].type).toBe('CONDITION_VALUE');
    expect(nodes[6].config.operator).toBe('>');
    expect(nodes[7].type).toBe('APPROVER');
    expect(nodes[7].config.approverRole).toBe('DIRETOR');

    // Penúltimo: SLA
    expect(nodes[8].type).toBe('SLA_TIMER');
    expect(nodes[8].config.slaHours).toBe(24);

    // Último: TERMINAL
    expect(nodes[9].type).toBe('TERMINAL');
  });

  it('deve incluir indicação de aprovação técnica nos nós de TI', () => {
    const nodes = buildWorkflowNodesFromModelo(modeloTi);

    // Modelo de TI tem 2 faixas com aprovacaoTecnica: true
    const approverNodes = nodes.filter((n) => n.type === 'APPROVER');
    expect(approverNodes.length).toBe(2);
    expect(approverNodes[0].title).toContain('Parecer Técnico');
    expect(approverNodes[0].icon).toBe('verified_user');
  });

  it('deve calcular o maior teto finito entre os nós', () => {
    const nodes = buildWorkflowNodesFromModelo(modeloReembolso);
    const ceiling = calculateCeilingFromNodes(nodes);
    expect(ceiling).toBe(2000);
  });

  it('deve extrair etapas de visualização para o card', () => {
    const nodes = buildWorkflowNodesFromModelo(modeloReembolso);
    const steps = extractStepsFromNodes(nodes);
    expect(steps.length).toBe(4);
    expect(steps[0].name).toBe('Solicitação');
    expect(steps[1].name).toBe('Triagem SoD');
    expect(steps[3].name).toBe('Homologação SHA-256');
  });

  it('deve converter modelo para objeto LimitRuleItem completo', () => {
    const rule = mapModeloToLimitRule(modeloReembolso, {
      id: 'ALC-9999',
      status: 'ACTIVE',
    });

    expect(rule.id).toBe('ALC-9999');
    expect(rule.title).toBe(modeloReembolso.nome);
    expect(rule.modeloId).toBe(modeloReembolso.id);
    expect(rule.nodes?.length).toBeGreaterThan(0);
    expect(rule.ceilingAmount).toBe(2000);
    expect(rule.status).toBe('ACTIVE');
  });

  describe('avaliarSolicitacaoNoFluxo (Motor de Governança)', () => {
    const regraTiComTeto: LimitRuleItem = {
      id: 'ALC-TI-101',
      title: 'Fluxo TI & Hardware',
      department: 'TI & Engenharia',
      assignedTo: 'Gerente de TI',
      employmentType: 'Despesas',
      locationOrCenter: 'cc-ti',
      channelOrOrigin: 'Portal Web',
      status: 'ACTIVE',
      statusLabel: 'Ativo',
      ceilingAmount: 15000,
      quorumLabel: '1 Aprovador',
      slaHours: 24,
      sodEnforced: true,
      createdAt: 'Hoje',
      accentColor: '#644EF3',
      currentStepLabel: 'Ativo',
      steps: [],
      category: 'EQUIPAMENTOS',
      nodes: [
        {
          id: 'cond-1',
          type: 'CONDITION_VALUE',
          title: 'Teto de Hardware (R$ 15.000)',
          subtitle: 'Limite máximo',
          tag: '<= R$ 15.000',
          tagColor: '#644EF3',
          icon: 'calculate',
          config: { valueMax: 15000 },
        },
        {
          id: 'app-1',
          type: 'APPROVER',
          title: 'Aprovação: Gerente de TI',
          subtitle: 'Deliberação do gestor',
          tag: 'Gerência',
          tagColor: '#10B981',
          icon: 'person_check',
          config: { approverRole: 'GERENTE' },
        },
      ],
    };

    it('aprova solicitação dentro do teto orçamentário e avança para aprovação gerencial', () => {
      const resultado = avaliarSolicitacaoNoFluxo(
        {
          valor: 8500,
          categoria: 'EQUIPAMENTOS',
          centroCustoId: 'cc-ti',
          departamento: 'TI & Engenharia',
        },
        [regraTiComTeto],
      );

      expect(resultado.aprovado).toBe(true);
      expect(resultado.status).toBe('PENDENTE');
      expect(resultado.alertaRisco).toBeNull();
      expect(resultado.etapaAtualNumero).toBe(3);
      expect(resultado.etapas[1].status).toBe('CONCLUIDA');
      expect(resultado.etapas[2].status).toBe('EM_ANALISE');
    });

    it('reprova automaticamente na etapa de governança solicitação que excede o teto e define EM_AJUSTE', () => {
      const resultado = avaliarSolicitacaoNoFluxo(
        {
          valor: 22000,
          categoria: 'EQUIPAMENTOS',
          centroCustoId: 'cc-ti',
          departamento: 'TI & Engenharia',
        },
        [regraTiComTeto],
      );

      expect(resultado.aprovado).toBe(false);
      expect(resultado.status).toBe('EM_AJUSTE');
      expect(resultado.statusLabel).toBe('Ajuste solicitado');
      expect(resultado.alertaRisco).toContain('Teto de Alçada Excedido');
      expect(resultado.alertaRisco).toContain('22.000');
      expect(resultado.alertaRisco).toContain('15.000');
      expect(resultado.etapaAtualNumero).toBe(2);
      expect(resultado.etapas[1].status).toBe('AJUSTE');
      expect(resultado.etapas[2].status).toBe('PENDENTE'); // Bloqueada para o gerente
    });
  });
});
