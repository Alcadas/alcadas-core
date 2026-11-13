/**
 * Catálogo de modelos pré-definidos de regras de alçada (Débito Técnico CP2 / #69) e
 * validação das faixas de valor, compartilhados entre o frontend (wizard de
 * criação em /alcadas/regras) e a API (PUT /organizacao/fluxos).
 */

export type CategoriaRegraAlcada = 'CAPEX' | 'OPERATIONAL' | 'GOVERNANCE' | 'CONTRACTS' | 'AUDIT';

export type PapelAprovadorRegra = 'COORDENADOR' | 'GERENTE' | 'DIRETOR' | 'CFO' | 'CONSELHO';

export type QuorumRegra = 'Aprovador Único' | 'Quórum Duplo' | 'Quórum Unânime';

export const PAPEIS_APROVADOR_REGRA: readonly { id: PapelAprovadorRegra; label: string }[] =
  Object.freeze([
    { id: 'COORDENADOR', label: 'Coordenação / Supervisão' },
    { id: 'GERENTE', label: 'Gerência' },
    { id: 'DIRETOR', label: 'Diretoria' },
    { id: 'CFO', label: 'CFO / Finanças' },
    { id: 'CONSELHO', label: 'Conselho de Administração' },
  ]);

export const QUORUNS_REGRA: readonly QuorumRegra[] = Object.freeze([
  'Aprovador Único',
  'Quórum Duplo',
  'Quórum Unânime',
]);

/** Faixa de valor de uma regra. `valorMaximo: null` significa "sem limite" (só permitido na última faixa). */
export interface FaixaRegraAlcada {
  id: string;
  valorMinimo: number | null;
  valorMaximo: number | null;
  papelAprovador: PapelAprovadorRegra | '';
  /** Exige parecer técnico (ex.: TI) antes da decisão do papel aprovador. */
  aprovacaoTecnica?: boolean;
}

export interface ModeloRegraAlcada {
  id: string;
  nome: string;
  descricao: string;
  icone: string;
  categoria: CategoriaRegraAlcada;
  centroCustoSugerido: string;
  quorum: QuorumRegra;
  slaHoras: number;
  faixas: readonly FaixaRegraAlcada[];
}

export const MODELOS_REGRAS_ALCADA: readonly ModeloRegraAlcada[] = Object.freeze([
  {
    id: 'reembolso-despesas-operacionais',
    nome: 'Reembolso de Despesas Operacionais',
    descricao:
      'Reembolsos do dia a dia (alimentação, transporte, materiais). Coordenação aprova até R$ 500 e Gerência até R$ 2.000.',
    icone: 'receipt_long',
    categoria: 'OPERATIONAL',
    centroCustoSugerido: 'CC-ADM · Administrativo',
    quorum: 'Aprovador Único',
    slaHoras: 24,
    faixas: [
      { id: 'f1', valorMinimo: 0, valorMaximo: 500, papelAprovador: 'COORDENADOR' },
      { id: 'f2', valorMinimo: 500.01, valorMaximo: 2000, papelAprovador: 'GERENTE' },
      { id: 'f3', valorMinimo: 2000.01, valorMaximo: null, papelAprovador: 'DIRETOR' },
    ],
  },
  {
    id: 'aquisicao-equipamentos-ti',
    nome: 'Aquisição de Equipamentos de TI / Hardware',
    descricao:
      'Notebooks, servidores e periféricos. Exige aprovação técnica de TI e, acima de R$ 10.000, chancela da Diretoria.',
    icone: 'devices',
    categoria: 'CAPEX',
    centroCustoSugerido: 'CC-TI · Tecnologia e Infraestrutura',
    quorum: 'Quórum Duplo',
    slaHoras: 48,
    faixas: [
      {
        id: 'f1',
        valorMinimo: 0,
        valorMaximo: 10000,
        papelAprovador: 'GERENTE',
        aprovacaoTecnica: true,
      },
      {
        id: 'f2',
        valorMinimo: 10000.01,
        valorMaximo: null,
        papelAprovador: 'DIRETOR',
        aprovacaoTecnica: true,
      },
    ],
  },
  {
    id: 'fornecedores-servicos-recorrentes',
    nome: 'Contratação de Fornecedores e Serviços Recorrentes',
    descricao:
      'Contratos mensais de limpeza, segurança, SaaS e manutenção. Escalona para o CFO em contratos acima de R$ 50.000.',
    icone: 'handshake',
    categoria: 'CONTRACTS',
    centroCustoSugerido: 'CC-SUP · Suprimentos e Compras',
    quorum: 'Aprovador Único',
    slaHoras: 72,
    faixas: [
      { id: 'f1', valorMinimo: 0, valorMaximo: 10000, papelAprovador: 'GERENTE' },
      { id: 'f2', valorMinimo: 10000.01, valorMaximo: 50000, papelAprovador: 'DIRETOR' },
      { id: 'f3', valorMinimo: 50000.01, valorMaximo: null, papelAprovador: 'CFO' },
    ],
  },
  {
    id: 'viagens-hospedagem',
    nome: 'Despesas de Viagens e Hospedagem',
    descricao:
      'Passagens, hotéis e diárias de viagens corporativas. Coordenação até R$ 1.500 e Gerência até R$ 5.000.',
    icone: 'flight_takeoff',
    categoria: 'CONTRACTS',
    centroCustoSugerido: 'Todos os Departamentos',
    quorum: 'Aprovador Único',
    slaHoras: 24,
    faixas: [
      { id: 'f1', valorMinimo: 0, valorMaximo: 1500, papelAprovador: 'COORDENADOR' },
      { id: 'f2', valorMinimo: 1500.01, valorMaximo: 5000, papelAprovador: 'GERENTE' },
      { id: 'f3', valorMinimo: 5000.01, valorMaximo: null, papelAprovador: 'DIRETOR' },
    ],
  },
  {
    id: 'consultoria-juridico',
    nome: 'Consultoria Especializada e Serviços Jurídicos',
    descricao:
      'Pareceres, auditorias externas e assessoria jurídica. Acima de R$ 100.000 exige deliberação do Conselho.',
    icone: 'gavel',
    categoria: 'GOVERNANCE',
    centroCustoSugerido: 'CC-JUR · Financeiro e Jurídico',
    quorum: 'Quórum Duplo',
    slaHoras: 48,
    faixas: [
      { id: 'f1', valorMinimo: 0, valorMaximo: 20000, papelAprovador: 'DIRETOR' },
      { id: 'f2', valorMinimo: 20000.01, valorMaximo: 100000, papelAprovador: 'CFO' },
      { id: 'f3', valorMinimo: 100000.01, valorMaximo: null, papelAprovador: 'CONSELHO' },
    ],
  },
]);

export function buscarModeloRegra(id: string): ModeloRegraAlcada | undefined {
  return MODELOS_REGRAS_ALCADA.find((modelo) => modelo.id === id);
}

export function rotuloPapelAprovador(papel: string): string {
  return PAPEIS_APROVADOR_REGRA.find((p) => p.id === papel)?.label ?? papel;
}

export interface ErroFaixaRegra {
  /** Índice da faixa com problema; `null` para erros da lista como um todo. */
  indice: number | null;
  campo: 'valorMinimo' | 'valorMaximo' | 'papelAprovador' | 'faixas';
  mensagem: string;
}

function numeroValido(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor);
}

function formatarReais(valor: number): string {
  return `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Valida as faixas de valor de uma regra:
 * - pelo menos uma faixa;
 * - mínimo informado e >= 0; máximo > mínimo;
 * - apenas a última faixa pode ser "sem limite" (máximo nulo);
 * - faixas em ordem crescente e sem sobreposição (mínimo de uma > máximo da anterior);
 * - papel aprovador obrigatório e conhecido.
 */
export function validarFaixasRegra(faixas: readonly FaixaRegraAlcada[] | undefined): ErroFaixaRegra[] {
  if (!Array.isArray(faixas) || faixas.length === 0) {
    return [{ indice: null, campo: 'faixas', mensagem: 'Informe ao menos uma faixa de valor.' }];
  }

  const erros: ErroFaixaRegra[] = [];

  faixas.forEach((faixa, indice) => {
    const ultima = indice === faixas.length - 1;
    const { valorMinimo, valorMaximo } = faixa;

    if (!numeroValido(valorMinimo) || valorMinimo < 0) {
      erros.push({ indice, campo: 'valorMinimo', mensagem: 'Informe um valor mínimo maior ou igual a zero.' });
    }

    if (valorMaximo === null || valorMaximo === undefined) {
      if (!ultima) {
        erros.push({
          indice,
          campo: 'valorMaximo',
          mensagem: 'Apenas a última faixa pode ficar sem limite máximo.',
        });
      }
    } else if (!numeroValido(valorMaximo) || valorMaximo <= 0) {
      erros.push({ indice, campo: 'valorMaximo', mensagem: 'Informe um valor máximo maior que zero.' });
    } else if (numeroValido(valorMinimo) && valorMaximo <= valorMinimo) {
      erros.push({
        indice,
        campo: 'valorMaximo',
        mensagem: `O valor máximo deve ser maior que o mínimo (${formatarReais(valorMinimo)}).`,
      });
    }

    if (indice > 0) {
      const anterior = faixas[indice - 1];
      if (
        numeroValido(anterior.valorMaximo) &&
        numeroValido(valorMinimo) &&
        valorMinimo <= anterior.valorMaximo
      ) {
        erros.push({
          indice,
          campo: 'valorMinimo',
          mensagem: `O mínimo deve ser maior que o máximo da faixa anterior (${formatarReais(anterior.valorMaximo)}).`,
        });
      }
    }

    if (!PAPEIS_APROVADOR_REGRA.some((p) => p.id === faixa.papelAprovador)) {
      erros.push({ indice, campo: 'papelAprovador', mensagem: 'Selecione o papel aprovador desta faixa.' });
    }
  });

  return erros;
}

/** Cria a faixa seguinte a partir da última, já contígua (mínimo = máximo anterior + 0,01). */
export function proximaFaixaRegra(faixas: readonly FaixaRegraAlcada[], id: string): FaixaRegraAlcada {
  const ultima = faixas[faixas.length - 1];
  const minimo =
    ultima && numeroValido(ultima.valorMaximo) ? Number((ultima.valorMaximo + 0.01).toFixed(2)) : 0;
  return { id, valorMinimo: minimo, valorMaximo: null, papelAprovador: '' };
}
