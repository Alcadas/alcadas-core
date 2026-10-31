import { Injectable, computed, signal } from '@angular/core';
import {
  CreateRequestDto,
  RequestCategory,
  RequestItem,
  RequestStats,
  WorkflowDestination,
} from '../requests.models';

export interface CostCenterOption {
  id: string;
  code: string;
  nome: string;
  departamento: string;
}

export interface CategoryOption {
  id: RequestCategory;
  label: string;
  icon: string;
  color: string;
  descricao: string;
}

@Injectable({
  providedIn: 'root',
})
export class RequestsService {
  readonly costCenters: CostCenterOption[] = [
    { id: 'cc-clinica-centro', code: 'CC-010', nome: 'Clínica Centro', departamento: 'Operações Médicas' },
    { id: 'cc-ti', code: 'CC-020', nome: 'Tecnologia & Inovação', departamento: 'TI & Engenharia' },
    { id: 'cc-rh', code: 'CC-030', nome: 'Gente & Gestão', departamento: 'Recursos Humanos' },
    { id: 'cc-financeiro', code: 'CC-040', nome: 'Controladoria & Finanças', departamento: 'Financeiro' },
    { id: 'cc-marketing', code: 'CC-050', nome: 'Marketing & Growth', departamento: 'Comercial' },
    { id: 'cc-juridico', code: 'CC-060', nome: 'Jurídico & Compliance', departamento: 'Governança' },
  ];

  readonly categories: CategoryOption[] = [
    {
      id: 'EQUIPAMENTOS_TI',
      label: 'Equipamentos & TI',
      icon: 'devices',
      color: '#644ef3',
      descricao: 'Softwares, hardware, licenças de sistemas e infraestrutura em nuvem',
    },
    {
      id: 'SERVICOS_TERCEIROS',
      label: 'Serviços de Terceiros',
      icon: 'handshake',
      color: '#0284c7',
      descricao: 'Contratações pontuais, consultorias terceirizadas e prestadores',
    },
    {
      id: 'MANUTENCAO_PREDIAL',
      label: 'Manutenção Predial',
      icon: 'build',
      color: '#ea580c',
      descricao: 'Reparos em instalações, manutenção de maquinários e reformas',
    },
    {
      id: 'MATERIAIS_ESCRITORIO',
      label: 'Materiais & Escritório',
      icon: 'inventory_2',
      color: '#16a34a',
      descricao: 'Insumos de consumo contínuo, papelaria, ergonomia e mobiliário',
    },
    {
      id: 'VIAGENS_HOSPEDAGEM',
      label: 'Viagens & Hospedagem',
      icon: 'flight',
      color: '#9333ea',
      descricao: 'Passagens, diárias, traslados e alimentação corporativa',
    },
    {
      id: 'MARKETING_EVENTOS',
      label: 'Marketing & Eventos',
      icon: 'campaign',
      color: '#e11d48',
      descricao: 'Campanhas de mídia, feiras, patrocínios e materiais promocionais',
    },
    {
      id: 'CONSULTORIA',
      label: 'Consultoria Especializada',
      icon: 'psychology',
      color: '#0d9488',
      descricao: 'Auditorias externas, pareceres jurídicos e planejamento estratégico',
    },
  ];

  private readonly _requests = signal<RequestItem[]>([
    {
      id: 'sol-001',
      codigo: '#SOL-2026-0094',
      titulo: 'Renovação Anual das Licenças Figma Enterprise & IDEs',
      descricao: 'Renovação de 25 licenças de desenvolvimento e design para os squads de produto do projeto Alçadas.',
      categoria: 'EQUIPAMENTOS_TI',
      categoriaLabel: 'Equipamentos & TI',
      categoriaIcon: 'devices',
      categoriaColor: '#644ef3',
      centroCustoId: 'cc-ti',
      centroCustoNome: 'Tecnologia & Inovação',
      departamento: 'TI & Engenharia',
      valor: 14850.0,
      prioridade: 'ALTA',
      status: 'PENDENTE',
      statusLabel: 'Em Análise',
      statusIcon: 'hourglass_top',
      dataCriacao: '2026-10-28T09:30:00Z',
      dataAtualizacao: '2026-10-30T14:15:00Z',
      solicitante: {
        id: 'usr-01',
        nome: 'Matheus Szervinsk',
        cargo: 'Tech Lead / Arquiteto',
        email: 'szervinsk@startop.com.br',
      },
      fluxoDestinado: {
        id: 'flow-ti-capex',
        nome: 'Alçada Corporativa de TI & Capex',
        totalEtapas: 3,
        etapaAtualNumero: 2,
        etapaAtualNome: 'N2 Diretoria Executiva',
        etapas: [
          {
            numero: 1,
            nome: 'Submissão Inicial',
            papel: 'Solicitante',
            responsavelNome: 'Matheus Szervinsk',
            status: 'CONCLUIDA',
            dataHora: '28/10/2026 09:30',
            comentario: 'Solicitação criada com 2 orçamentos oficiais anexados.',
          },
          {
            numero: 2,
            nome: 'Parecer Gerencial N1',
            papel: 'Gerente de TI',
            responsavelNome: 'Carlos Eduardo Silva',
            status: 'CONCLUIDA',
            dataHora: '29/10/2026 11:20',
            comentario: 'Aprovado. Despesa prevista no orçamento semestral de ferramentas de software.',
          },
          {
            numero: 3,
            nome: 'Aprovação Diretoria N2',
            papel: 'Diretoria Executiva',
            responsavelNome: 'Dra. Mariana Santos',
            status: 'EM_ANALISE',
            dataHora: '30/10/2026 14:15',
            comentario: 'Aguardando validação da dotação financeira pela Controladoria.',
          },
        ],
      },
      anexos: [
        {
          id: 'att-1',
          nome: 'Cotacao_Figma_Enterprise_2026.pdf',
          tamanho: '1.4 MB',
          tipo: 'application/pdf',
          icone: 'picture_as_pdf',
        },
        {
          id: 'att-2',
          nome: 'Parecer_Tecnico_Equipe_Dev.docx',
          tamanho: '450 KB',
          tipo: 'application/docx',
          icone: 'description',
        },
      ],
    },
    {
      id: 'sol-002',
      codigo: '#SOL-2026-0091',
      titulo: 'Manutenção Preventiva do Aparelho de Raio-X e Tomografia',
      descricao: 'Calibração semestral obrigatória pela vigilância sanitária para equipamentos de imagem da unidade Centro.',
      categoria: 'MANUTENCAO_PREDIAL',
      categoriaLabel: 'Manutenção Predial',
      categoriaIcon: 'build',
      categoriaColor: '#ea580c',
      centroCustoId: 'cc-clinica-centro',
      centroCustoNome: 'Clínica Centro',
      departamento: 'Operações Médicas',
      valor: 3200.0,
      prioridade: 'CRITICA',
      status: 'APROVADA',
      statusLabel: 'Aprovada',
      statusIcon: 'check_circle',
      dataCriacao: '2026-10-27T10:02:00Z',
      dataAtualizacao: '2026-10-27T14:30:00Z',
      solicitante: {
        id: 'usr-02',
        nome: 'Ana Carolina Lima',
        cargo: 'Supervisora de Operações',
        email: 'ana.lima@startop.com.br',
      },
      fluxoDestinado: {
        id: 'flow-clinica-op',
        nome: 'Alçada Operacional Clínica',
        totalEtapas: 2,
        etapaAtualNumero: 2,
        etapaAtualNome: 'Aprovada Integralmente',
        etapas: [
          {
            numero: 1,
            nome: 'Submissão Inicial',
            papel: 'Solicitante',
            responsavelNome: 'Ana Carolina Lima',
            status: 'CONCLUIDA',
            dataHora: '27/10/2026 10:02',
            comentario: 'Solicitação urgente com relatório técnico da Anvisa.',
          },
          {
            numero: 2,
            nome: 'Aprovação Gerência N1',
            papel: 'Gerente de Unidade',
            responsavelNome: 'Carlos Silva',
            status: 'CONCLUIDA',
            dataHora: '27/10/2026 14:30',
            comentario: 'Aprovado. Serviço essencial e dentro do teto de R$ 5.000,00 da unidade.',
          },
        ],
      },
      anexos: [
        {
          id: 'att-3',
          nome: 'Laudo_Calibracao_Equipamentos.pdf',
          tamanho: '2.8 MB',
          tipo: 'application/pdf',
          icone: 'picture_as_pdf',
        },
      ],
    },
    {
      id: 'sol-003',
      codigo: '#SOL-2026-0088',
      titulo: 'Contratação de Consultoria Especializada em LGPD e Segurança',
      descricao: 'Auditoria externa de conformidade regulatória para adequação aos novos requisitos da ANS.',
      categoria: 'CONSULTORIA',
      categoriaLabel: 'Consultoria Especializada',
      categoriaIcon: 'psychology',
      categoriaColor: '#0d9488',
      centroCustoId: 'cc-juridico',
      centroCustoNome: 'Jurídico & Compliance',
      departamento: 'Governança',
      valor: 28500.0,
      prioridade: 'ALTA',
      status: 'PENDENTE',
      statusLabel: 'Em Análise',
      statusIcon: 'hourglass_top',
      dataCriacao: '2026-10-25T11:45:00Z',
      dataAtualizacao: '2026-10-29T16:20:00Z',
      solicitante: {
        id: 'usr-01',
        nome: 'Matheus Szervinsk',
        cargo: 'Tech Lead / Arquiteto',
        email: 'szervinsk@startop.com.br',
      },
      fluxoDestinado: {
        id: 'flow-compliance',
        nome: 'Alçada Estratégica & Governança',
        totalEtapas: 4,
        etapaAtualNumero: 3,
        etapaAtualNome: 'N3 Diretoria Jurídica & CFO',
        etapas: [
          {
            numero: 1,
            nome: 'Submissão Inicial',
            papel: 'Solicitante',
            responsavelNome: 'Matheus Szervinsk',
            status: 'CONCLUIDA',
            dataHora: '25/10/2026 11:45',
          },
          {
            numero: 2,
            nome: 'Parecer Jurídico N1',
            papel: 'Coordenador Compliance',
            responsavelNome: 'Renata Albuquerque',
            status: 'CONCLUIDA',
            dataHora: '26/10/2026 15:10',
            comentario: 'Escopo alinhado com as exigências da portaria regulatória.',
          },
          {
            numero: 3,
            nome: 'Parecer Diretoria N2',
            papel: 'Diretor Jurídico',
            responsavelNome: 'Dr. Fernando Prado',
            status: 'CONCLUIDA',
            dataHora: '28/10/2026 17:00',
            comentario: 'Validado. Encaminhado para liberação do CFO devido ao valor > R$ 25.000.',
          },
          {
            numero: 4,
            nome: 'Liberação Financeira N3',
            papel: 'CFO / Finanças',
            responsavelNome: 'Patrícia Guimarães',
            status: 'EM_ANALISE',
            dataHora: '29/10/2026 16:20',
          },
        ],
      },
      anexos: [
        {
          id: 'att-4',
          nome: 'Proposta_Comercial_Auditoria.pdf',
          tamanho: '3.1 MB',
          tipo: 'application/pdf',
          icone: 'picture_as_pdf',
        },
      ],
    },
    {
      id: 'sol-004',
      codigo: '#SOL-2026-0082',
      titulo: 'Aquisição de Cadeiras Ergonômicas e Estações de Trabalho',
      descricao: 'Troca de 12 cadeiras para a equipe de atendimento presencial em conformidade com o laudo ergonômico NR-17.',
      categoria: 'MATERIAIS_ESCRITORIO',
      categoriaLabel: 'Materiais & Escritório',
      categoriaIcon: 'inventory_2',
      categoriaColor: '#16a34a',
      centroCustoId: 'cc-rh',
      centroCustoNome: 'Gente & Gestão',
      departamento: 'Recursos Humanos',
      valor: 4750.0,
      prioridade: 'MEDIA',
      status: 'AJUSTE_SOLICITADO',
      statusLabel: 'Ajuste Solicitado',
      statusIcon: 'edit_note',
      dataCriacao: '2026-10-23T14:10:00Z',
      dataAtualizacao: '2026-10-26T08:50:00Z',
      solicitante: {
        id: 'usr-03',
        nome: 'Juliana Pires',
        cargo: 'Analista de RH Pleno',
        email: 'juliana.pires@startop.com.br',
      },
      fluxoDestinado: {
        id: 'flow-compras-geral',
        nome: 'Alçada Geral de Compras e Suprimentos',
        totalEtapas: 2,
        etapaAtualNumero: 1,
        etapaAtualNome: 'Revisão do Solicitante',
        etapas: [
          {
            numero: 1,
            nome: 'Submissão Inicial',
            papel: 'Solicitante',
            responsavelNome: 'Juliana Pires',
            status: 'CONCLUIDA',
            dataHora: '23/10/2026 14:10',
          },
          {
            numero: 2,
            nome: 'Aprovação N1 Suprimentos',
            papel: 'Gerente Administrativo',
            responsavelNome: 'Roberto Alencar',
            status: 'AJUSTE',
            dataHora: '26/10/2026 08:50',
            comentario: 'Favor anexar ao menos 3 orçamentos comparativos de marcas diferentes conforme política interna.',
          },
        ],
      },
      anexos: [
        {
          id: 'att-5',
          nome: 'Orcamento_Cadeiras_Flexform.pdf',
          tamanho: '890 KB',
          tipo: 'application/pdf',
          icone: 'picture_as_pdf',
        },
      ],
    },
    {
      id: 'sol-005',
      codigo: '#SOL-2026-0079',
      titulo: 'Campanha de Divulgação da Nova Ala Cirúrgica nas Redes',
      descricao: 'Investimento em anúncios patrocinados no Google Ads e Meta Ads para lançamento dos novos leitos.',
      categoria: 'MARKETING_EVENTOS',
      categoriaLabel: 'Marketing & Eventos',
      categoriaIcon: 'campaign',
      categoriaColor: '#e11d48',
      centroCustoId: 'cc-marketing',
      centroCustoNome: 'Marketing & Growth',
      departamento: 'Comercial',
      valor: 8900.0,
      prioridade: 'MEDIA',
      status: 'APROVADA',
      statusLabel: 'Aprovada',
      statusIcon: 'check_circle',
      dataCriacao: '2026-10-20T16:00:00Z',
      dataAtualizacao: '2026-10-22T10:15:00Z',
      solicitante: {
        id: 'usr-01',
        nome: 'Matheus Szervinsk',
        cargo: 'Tech Lead / Arquiteto',
        email: 'szervinsk@startop.com.br',
      },
      fluxoDestinado: {
        id: 'flow-marketing',
        nome: 'Alçada de Marketing & Campanhas',
        totalEtapas: 2,
        etapaAtualNumero: 2,
        etapaAtualNome: 'Aprovada Integralmente',
        etapas: [
          {
            numero: 1,
            nome: 'Submissão Inicial',
            papel: 'Solicitante',
            responsavelNome: 'Matheus Szervinsk',
            status: 'CONCLUIDA',
            dataHora: '20/10/2026 16:00',
          },
          {
            numero: 2,
            nome: 'Aprovação N1 Marketing & Finanças',
            papel: 'Head de Marketing',
            responsavelNome: 'Lucas Vasconcelos',
            status: 'CONCLUIDA',
            dataHora: '22/10/2026 10:15',
            comentario: 'Verba liberada dentro da meta de aquisição do 4º trimestre.',
          },
        ],
      },
      anexos: [
        {
          id: 'att-6',
          nome: 'Plano_Midia_Novos_Leitos_Q4.pdf',
          tamanho: '1.9 MB',
          tipo: 'application/pdf',
          icone: 'picture_as_pdf',
        },
      ],
    },
    {
      id: 'sol-006',
      codigo: '#SOL-2026-0074',
      titulo: 'Reembolso de Viagem para Conferência Internacional de TI',
      descricao: 'Hospedagem, alimentação e passagens de participação no evento de Arquitetura Cloud em SP.',
      categoria: 'VIAGENS_HOSPEDAGEM',
      categoriaLabel: 'Viagens & Hospedagem',
      categoriaIcon: 'flight',
      categoriaColor: '#9333ea',
      centroCustoId: 'cc-ti',
      centroCustoNome: 'Tecnologia & Inovação',
      departamento: 'TI & Engenharia',
      valor: 6300.0,
      prioridade: 'BAIXA',
      status: 'REJEITADA',
      statusLabel: 'Rejeitada',
      statusIcon: 'cancel',
      dataCriacao: '2026-10-18T14:20:00Z',
      dataAtualizacao: '2026-10-19T11:40:00Z',
      solicitante: {
        id: 'usr-04',
        nome: 'Gabriel Fontes',
        cargo: 'Desenvolvedor Frontend Sênior',
        email: 'gabriel.fontes@startop.com.br',
      },
      fluxoDestinado: {
        id: 'flow-viagens',
        nome: 'Alçada de Viagens & Reembolsos',
        totalEtapas: 2,
        etapaAtualNumero: 2,
        etapaAtualNome: 'Encerrada com Recusa',
        etapas: [
          {
            numero: 1,
            nome: 'Submissão Inicial',
            papel: 'Solicitante',
            responsavelNome: 'Gabriel Fontes',
            status: 'CONCLUIDA',
            dataHora: '18/10/2026 14:20',
          },
          {
            numero: 2,
            nome: 'Aprovação N1 Diretoria de Pessoas',
            papel: 'Gerente Geral',
            responsavelNome: 'Roberto Alencar',
            status: 'REJEITADA',
            dataHora: '19/10/2026 11:40',
            comentario: 'O teto semestral de viagens de conferência da squad foi excedido. Solicitação recusada.',
          },
        ],
      },
      anexos: [
        {
          id: 'att-7',
          nome: 'Comprovantes_Despesas_Viagem.pdf',
          tamanho: '4.2 MB',
          tipo: 'application/pdf',
          icone: 'picture_as_pdf',
        },
      ],
    },
    {
      id: 'sol-007',
      codigo: '#SOL-2026-0068',
      titulo: 'Contratação de Servidores em Nuvem e Rotinas de Backup',
      descricao: 'Ampliação do cluster de banco de dados e instâncias redundantes para suportar o novo fluxo de alçadas.',
      categoria: 'EQUIPAMENTOS_TI',
      categoriaLabel: 'Equipamentos & TI',
      categoriaIcon: 'devices',
      categoriaColor: '#644ef3',
      centroCustoId: 'cc-ti',
      centroCustoNome: 'Tecnologia & Inovação',
      departamento: 'TI & Engenharia',
      valor: 19200.0,
      prioridade: 'ALTA',
      status: 'APROVADA',
      statusLabel: 'Aprovada',
      statusIcon: 'check_circle',
      dataCriacao: '2026-10-15T08:00:00Z',
      dataAtualizacao: '2026-10-17T17:00:00Z',
      solicitante: {
        id: 'usr-01',
        nome: 'Matheus Szervinsk',
        cargo: 'Tech Lead / Arquiteto',
        email: 'szervinsk@startop.com.br',
      },
      fluxoDestinado: {
        id: 'flow-ti-capex',
        nome: 'Alçada Corporativa de TI & Capex',
        totalEtapas: 3,
        etapaAtualNumero: 3,
        etapaAtualNome: 'Aprovada Integralmente',
        etapas: [
          {
            numero: 1,
            nome: 'Submissão Inicial',
            papel: 'Solicitante',
            responsavelNome: 'Matheus Szervinsk',
            status: 'CONCLUIDA',
            dataHora: '15/10/2026 08:00',
          },
          {
            numero: 2,
            nome: 'Parecer Gerencial N1',
            papel: 'Gerente TI',
            responsavelNome: 'Carlos Eduardo Silva',
            status: 'CONCLUIDA',
            dataHora: '16/10/2026 10:00',
            comentario: 'Imprescindível para garantir RTO/RPO de governança.',
          },
          {
            numero: 3,
            nome: 'Aprovação Diretoria N2',
            papel: 'Diretoria Executiva',
            responsavelNome: 'Dra. Mariana Santos',
            status: 'CONCLUIDA',
            dataHora: '17/10/2026 17:00',
            comentario: 'Aprovado conforme plano de continuidade de negócios.',
          },
        ],
      },
      anexos: [
        {
          id: 'att-8',
          nome: 'Contrato_GCP_Cloud_Infrastructure.pdf',
          tamanho: '1.2 MB',
          tipo: 'application/pdf',
          icone: 'picture_as_pdf',
        },
      ],
    },
  ]);

  readonly requests = this._requests.asReadonly();

  readonly stats = computed<RequestStats>(() => {
    const list = this._requests();
    const total = list.length;
    const pendentes = list.filter((r) => r.status === 'PENDENTE');
    const aprovadas = list.filter((r) => r.status === 'APROVADA');
    const ajustes = list.filter((r) => r.status === 'AJUSTE_SOLICITADO');
    const rejeitadas = list.filter((r) => r.status === 'REJEITADA');

    const pendentesValorTotal = pendentes.reduce((acc, curr) => acc + curr.valor, 0);
    const taxaAprovacao = total > 0 ? Math.round((aprovadas.length / total) * 100) : 0;
    const totalPercentCompleted = total > 0 ? Math.round(((aprovadas.length + rejeitadas.length) / total) * 100) : 0;

    return {
      total,
      totalPercentCompleted,
      pendentes: pendentes.length,
      pendentesValorTotal,
      aprovadas: aprovadas.length,
      taxaAprovacao,
      ajustes: ajustes.length,
      rejeitadas: rejeitadas.length,
    };
  });

  calculateSuggestedWorkflow(valor: number, centroCustoId: string, categoria?: RequestCategory): WorkflowDestination {
    const cc = this.costCenters.find((c) => c.id === centroCustoId) || this.costCenters[0];
    const cat = this.categories.find((c) => c.id === categoria);
    const catSuffix = cat ? ` (${cat.label})` : '';

    if (valor <= 5000) {
      return {
        id: `flow-${cc.id}-n1`,
        nome: `Fluxo Padrão Operacional - ${cc.nome}${catSuffix}`,
        totalEtapas: 2,
        etapaAtualNumero: 1,
        etapaAtualNome: 'N1 Gerência de Unidade',
        etapas: [
          {
            numero: 1,
            nome: 'Submissão Inicial',
            papel: 'Solicitante',
            responsavelNome: 'Você (Solicitante)',
            status: 'CONCLUIDA',
            dataHora: 'Agora mesmo',
            comentario: 'Solicitação criada no sistema.',
          },
          {
            numero: 2,
            nome: 'Aprovação N1 Gerência',
            papel: 'Gerente da Área',
            responsavelNome: 'A definir (Gerência)',
            status: 'PENDENTE',
            comentario: 'Aguardando validação dentro do teto de até R$ 5.000,00.',
          },
        ],
      };
    } else if (valor <= 25000) {
      return {
        id: `flow-${cc.id}-n2`,
        nome: `Alçada Tática N1-N2 - ${cc.nome}`,
        totalEtapas: 3,
        etapaAtualNumero: 1,
        etapaAtualNome: 'N1 Parecer Gerencial',
        etapas: [
          {
            numero: 1,
            nome: 'Submissão Inicial',
            papel: 'Solicitante',
            responsavelNome: 'Você (Solicitante)',
            status: 'CONCLUIDA',
            dataHora: 'Agora mesmo',
            comentario: 'Solicitação criada no sistema.',
          },
          {
            numero: 2,
            nome: 'Parecer N1 Gerência',
            papel: 'Gerente da Área',
            responsavelNome: 'Carlos Eduardo Silva',
            status: 'PENDENTE',
            comentario: 'Análise de aderência técnica ao orçamento.',
          },
          {
            numero: 3,
            nome: 'Aprovação N2 Diretoria',
            papel: 'Diretor Executivo',
            responsavelNome: 'Dra. Mariana Santos',
            status: 'PENDENTE',
            comentario: 'Decisão final sobre valores entre R$ 5.000,01 e R$ 25.000,00.',
          },
        ],
      };
    } else {
      return {
        id: `flow-${cc.id}-n3`,
        nome: `Alçada Estratégica & Conselho - ${cc.nome}`,
        totalEtapas: 4,
        etapaAtualNumero: 1,
        etapaAtualNome: 'N1 Gerência Responsável',
        etapas: [
          {
            numero: 1,
            nome: 'Submissão Inicial',
            papel: 'Solicitante',
            responsavelNome: 'Você (Solicitante)',
            status: 'CONCLUIDA',
            dataHora: 'Agora mesmo',
            comentario: 'Solicitação de alto valor submetida.',
          },
          {
            numero: 2,
            nome: 'Parecer N1 Gerencial',
            papel: 'Gerente da Área',
            responsavelNome: 'Carlos Eduardo Silva',
            status: 'PENDENTE',
          },
          {
            numero: 3,
            nome: 'Avaliação N2 Diretoria',
            papel: 'Diretoria de Operações',
            responsavelNome: 'Dra. Mariana Santos',
            status: 'PENDENTE',
          },
          {
            numero: 4,
            nome: 'Aprovação N3 Comitê / CFO',
            papel: 'CFO / Comitê Financeiro',
            responsavelNome: 'Patrícia Guimarães',
            status: 'PENDENTE',
            comentario: 'Validação de teto extraordinário (> R$ 25.000,00).',
          },
        ],
      };
    }
  }

  createRequest(dto: CreateRequestDto): RequestItem {
    const cat = this.categories.find((c) => c.id === dto.categoria) || this.categories[0];
    const cc = this.costCenters.find((c) => c.id === dto.centroCustoId) || this.costCenters[0];
    const workflow = this.calculateSuggestedWorkflow(dto.valor, dto.centroCustoId, dto.categoria);

    // Gera ID sequencial amigável
    const nextNum = this._requests().length + 100;
    const codigo = `#SOL-2026-0${nextNum}`;
    const nowIso = new Date().toISOString();

    const newRequest: RequestItem = {
      id: `sol-${Date.now()}`,
      codigo,
      titulo: dto.titulo,
      descricao: dto.justificativa,
      categoria: dto.categoria,
      categoriaLabel: cat.label,
      categoriaIcon: cat.icon,
      categoriaColor: cat.color,
      centroCustoId: cc.id,
      centroCustoNome: cc.nome,
      departamento: cc.departamento,
      valor: dto.valor,
      prioridade: dto.prioridade,
      status: 'PENDENTE',
      statusLabel: 'Em Análise',
      statusIcon: 'hourglass_top',
      dataCriacao: nowIso,
      dataAtualizacao: nowIso,
      solicitante: {
        id: 'usr-01',
        nome: 'Matheus Szervinsk',
        cargo: 'Tech Lead / Solicitante',
        email: 'szervinsk@startop.com.br',
      },
      fluxoDestinado: workflow,
      anexos: (dto.anexos || []).map((a, idx) => ({
        id: `att-new-${idx}-${Date.now()}`,
        nome: a.nome,
        tamanho: a.tamanho,
        tipo: a.tipo || 'application/pdf',
        icone: a.nome.endsWith('.pdf') ? 'picture_as_pdf' : 'description',
      })),
    };

    this._requests.update((list) => [newRequest, ...list]);
    return newRequest;
  }

  cancelRequest(id: string): boolean {
    let updated = false;
    this._requests.update((list) =>
      list.map((req) => {
        if (req.id === id && (req.status === 'PENDENTE' || req.status === 'AJUSTE_SOLICITADO')) {
          updated = true;
          return {
            ...req,
            status: 'CANCELADA',
            statusLabel: 'Cancelada',
            statusIcon: 'do_not_disturb_on',
            dataAtualizacao: new Date().toISOString(),
          };
        }
        return req;
      })
    );
    return updated;
  }
}
