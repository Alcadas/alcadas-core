import { MODELOS_REGRAS_ALCADA } from '@alcadas-core/models';
import {
  buildWorkflowNodesFromFaixas,
  buildWorkflowNodesFromModelo,
  calculateCeilingFromNodes,
  extractStepsFromNodes,
  formatCurrencyBRL,
  mapModeloToLimitRule,
} from './limits-workflow.utils';

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
});
