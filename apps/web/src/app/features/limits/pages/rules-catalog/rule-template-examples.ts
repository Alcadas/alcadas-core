import { ModeloRegraAlcada, buscarModeloRegra } from '@alcadas-core/models';

/**
 * Modelos novos para as regras predefinidas que não têm equivalente em MODELOS_REGRAS_ALCADA (#69).
 */
const MODELOS_NOVOS: Readonly<Record<string, ModeloRegraAlcada>> = {
  'Dupla Aprovação (2 Pessoas)': {
    id: 'pagamentos-dupla-assinatura',
    nome: 'Pagamentos a Fornecedores com Dupla Assinatura',
    descricao:
      'Pagamentos exigem duas assinaturas independentes: Diretoria até R$ 50.000 e CFO acima disso, sempre com um segundo aprovador.',
    icone: 'group',
    categoria: 'GOVERNANCE',
    centroCustoSugerido: 'CC-FIN · Controladoria e Finanças',
    quorum: 'Quórum Duplo',
    slaHoras: 48,
    faixas: [
      { id: 'f1', valorMinimo: 0, valorMaximo: 50000, papelAprovador: 'DIRETOR' },
      { id: 'f2', valorMinimo: 50000.01, valorMaximo: null, papelAprovador: 'CFO' },
    ],
  },
  'Anti-Fracionamento & SoD': {
    id: 'compras-anti-fracionamento',
    nome: 'Compras com Controle de Fracionamento (30 dias)',
    descricao:
      'Soma as compras do mesmo fornecedor em janela móvel de 30 dias para definir a alçada e bloqueia autoaprovação do solicitante.',
    icone: 'security',
    categoria: 'AUDIT',
    centroCustoSugerido: 'CC-AUD · Auditoria e Riscos',
    quorum: 'Aprovador Único',
    slaHoras: 24,
    faixas: [
      { id: 'f1', valorMinimo: 0, valorMaximo: 8000, papelAprovador: 'GERENTE' },
      { id: 'f2', valorMinimo: 8000.01, valorMaximo: 50000, papelAprovador: 'DIRETOR' },
      { id: 'f3', valorMinimo: 50000.01, valorMaximo: null, papelAprovador: 'CFO' },
    ],
  },
  'Teto Emergencial TI (Até R$ 50.000)': {
    id: 'incidentes-infra-cloud',
    nome: 'Incidentes de Infraestrutura Cloud',
    descricao:
      'Despesas emergenciais de infraestrutura até R$ 50.000 com aprovação imediata do CTO (Diretoria); acima disso, decisão do CFO.',
    icone: 'bolt',
    categoria: 'CAPEX',
    centroCustoSugerido: 'CC-TI · Tecnologia e Infraestrutura',
    quorum: 'Aprovador Único',
    slaHoras: 4,
    faixas: [
      { id: 'f1', valorMinimo: 0, valorMaximo: 50000, papelAprovador: 'DIRETOR' },
      { id: 'f2', valorMinimo: 50000.01, valorMaximo: null, papelAprovador: 'CFO' },
    ],
  },
  'SLA Crítico Fast-Track (12 Horas)': {
    id: 'materias-primas-fast-track',
    nome: 'Matérias-Primas Críticas (Fast-Track 12h)',
    descricao:
      'Compras de matérias-primas críticas para a produção com prazo máximo de 12 horas por aprovador antes do escalonamento.',
    icone: 'timer',
    categoria: 'OPERATIONAL',
    centroCustoSugerido: 'CC-PRD · Engenharia e Produção',
    quorum: 'Aprovador Único',
    slaHoras: 12,
    faixas: [
      { id: 'f1', valorMinimo: 0, valorMaximo: 30000, papelAprovador: 'GERENTE' },
      { id: 'f2', valorMinimo: 30000.01, valorMaximo: null, papelAprovador: 'DIRETOR' },
    ],
  },
};

/** Regras predefinidas que reaproveitam um modelo já existente em MODELOS_REGRAS_ALCADA (#69). */
const MODELOS_REAPROVEITADOS: Readonly<Record<string, string>> = {
  'Teto de Valor (<, >, =)': 'reembolso-despesas-operacionais',
  'Aprovador Único': 'viagens-hospedagem',
  'Tempo / SLA de Resposta': 'fornecedores-servicos-recorrentes',
  'Gatilho de Centro de Custo': 'aquisicao-equipamentos-ti',
  'Parecer Jurídico & Compliance > R$ 100k': 'consultoria-juridico',
};

/** Modelo exemplo de uma regra predefinida (pelo título), ou `undefined` se não houver. */
export function modeloExemploDaRegra(tituloRegra: string): ModeloRegraAlcada | undefined {
  const reaproveitado = MODELOS_REAPROVEITADOS[tituloRegra];
  return reaproveitado ? buscarModeloRegra(reaproveitado) : MODELOS_NOVOS[tituloRegra];
}
