import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  ErroFaixaRegra,
  FaixaRegraAlcada,
  MODELOS_REGRAS_ALCADA,
  ModeloRegraAlcada,
  PAPEIS_APROVADOR_REGRA,
  QUORUNS_REGRA,
  QuorumRegra,
  proximaFaixaRegra,
  rotuloPapelAprovador,
  validarFaixasRegra,
} from '@alcadas-core/models';
import { PageHeaderComponent, PageHeaderTab } from '../../../../shared/components/page-header/page-header.component';
import { LimitsService } from '../../services/limits.service';
import { formatCurrencyBRL } from '../../services/limits-workflow.utils';

export type FlowWizardStep = 'choose' | 'template' | 'configure' | 'scratch';

@Component({
  selector: 'app-my-limits',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeaderComponent],
  templateUrl: './my-limits.component.html',
  styleUrl: './my-limits.component.scss',
})
export class MyLimitsComponent {
  private readonly router = inject(Router);
  protected readonly limitsService = inject(LimitsService);

  // Estado de Carregamento da Lista
  readonly isLoading = signal(true);

  // Controle de menu contextual de ações
  readonly openMenuId = signal<string | null>(null);

  // =========================================================================
  // WIZARD DE CRIAÇÃO DE FLUXOS COM MODELOS PRÉ-DEFINIDOS (#69 / CP2)
  // =========================================================================
  readonly isCreateModalOpen = signal(false);
  readonly wizardStep = signal<FlowWizardStep>('choose');
  readonly selectedModelo = signal<ModeloRegraAlcada | null>(null);

  readonly modelos = MODELOS_REGRAS_ALCADA;
  readonly quoruns = QUORUNS_REGRA;
  readonly papeisAprovador = PAPEIS_APROVADOR_REGRA;
  readonly rotuloPapel = rotuloPapelAprovador;
  readonly formatCurrency = formatCurrencyBRL;

  readonly wizardName = signal<string>('');
  readonly wizardCostCenter = signal<string>('');
  readonly wizardQuorum = signal<QuorumRegra>('Aprovador Único');
  readonly wizardSlaHours = signal<number | null>(24);
  readonly wizardDescription = signal<string>('');
  readonly wizardFaixas = signal<FaixaRegraAlcada[]>([]);
  readonly faixasMaximoEmBranco = signal<ReadonlySet<string>>(new Set());
  readonly activateImmediately = signal<boolean>(true);
  private faixaSeq = 0;

  // Campos para criação do zero (Scratch)
  readonly newRuleTitle = signal('');
  readonly newRuleDept = signal('Tecnologia & Infra');
  readonly newRuleAmount = signal(25000);
  readonly newRuleQuorum = signal('1 Aprovador (Assinatura Individual)');

  readonly costCenterSuggestions = computed(() => {
    const fromOrg = this.limitsService
      .departments()
      .map((d) => (d.costCenter ? `${d.costCenter} · ${d.name}` : d.name));
    const fromModels = this.modelos.map((m) => m.centroCustoSugerido);
    return Array.from(new Set([...fromOrg, ...fromModels]));
  });

  readonly wizardFaixaErrors = computed<ErroFaixaRegra[]>(() => {
    const faixas = this.wizardFaixas();
    const emBranco = this.faixasMaximoEmBranco();
    const indicesEmBranco = new Set(
      faixas
        .map((f, i) => (f.valorMaximo === null && emBranco.has(f.id) ? i : -1))
        .filter((i) => i >= 0),
    );
    const erros = validarFaixasRegra(faixas).filter(
      (e) => !(e.campo === 'valorMaximo' && e.indice !== null && indicesEmBranco.has(e.indice)),
    );
    const errosEmBranco = [...indicesEmBranco].map(
      (indice) =>
        ({ indice, campo: 'valorMaximo', mensagem: 'Informe o valor máximo.' }) as ErroFaixaRegra,
    );
    return [...erros, ...errosEmBranco];
  });

  readonly wizardNameError = computed(() =>
    this.wizardName().trim() ? null : 'Informe o nome do fluxo.',
  );

  readonly wizardSlaError = computed(() => {
    const sla = this.wizardSlaHours();
    return typeof sla === 'number' && sla > 0 ? null : 'O SLA deve ser maior que zero.';
  });

  readonly canSaveWizard = computed(
    () =>
      !this.wizardNameError() &&
      !this.wizardSlaError() &&
      this.wizardFaixaErrors().length === 0,
  );

  readonly wizardCeiling = computed(() => {
    const maximos = this.wizardFaixas()
      .map((f) => f.valorMaximo)
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    return maximos.length ? Math.max(...maximos) : 0;
  });

  // Tabs do topo com contadores sincronizados com o banco de dados
  readonly pageHeaderTabs = computed<PageHeaderTab[]>(() => {
    const all = this.limitsService.allRules();
    const activeCount = all.filter((r) => r.status === 'ACTIVE').length;
    const draftCount = all.filter((r) => r.status === 'DRAFT').length;
    return [
      { id: 'all', label: 'Todas', icon: 'shield', badge: all.length },
      { id: 'active', label: 'Ativas', icon: 'check_circle', badge: activeCount, badgeVariant: 'success' },
      { id: 'draft', label: 'Rascunhos', icon: 'edit_note', badge: draftCount, badgeVariant: 'warning' },
      { id: 'completed', label: 'Homologadas', icon: 'task_alt' },
      { id: 'templates', label: 'Modelos', icon: 'auto_awesome' },
    ];
  });

  selectTab(tabId: string): void {
    this.limitsService.activeTab.set(tabId);
  }

  onSearchChange(val: string): void {
    this.limitsService.searchQuery.set(val);
  }

  toggleActionsMenu(id: string, event: Event): void {
    event.stopPropagation();
    this.openMenuId.update((current) => (current === id ? null : id));
  }

  closeActionsMenu(): void {
    this.openMenuId.set(null);
  }

  navigateToEditor(ruleId: string): void {
    this.router.navigate(['/alcadas/editor', ruleId]);
  }

  goToRulesCatalog(): void {
    this.router.navigate(['/alcadas/regras']);
  }

  openCreateModal(): void {
    this.wizardStep.set('choose');
    this.selectedModelo.set(null);
    this.activateImmediately.set(true);
    this.faixasMaximoEmBranco.set(new Set());

    this.newRuleTitle.set('');
    const depts = this.limitsService.departments();
    if (depts.length > 0) {
      this.newRuleDept.set(depts[0].name);
    }
    this.newRuleAmount.set(25000);
    this.isCreateModalOpen.set(true);
  }

  closeCreateModal(): void {
    this.isCreateModalOpen.set(false);
  }

  startFromTemplate(): void {
    this.wizardStep.set('template');
  }

  startFromScratch(): void {
    this.wizardStep.set('scratch');
  }

  selectTemplate(modelo: ModeloRegraAlcada): void {
    this.selectedModelo.set(modelo);
    this.wizardName.set(modelo.nome);
    this.wizardCostCenter.set(modelo.centroCustoSugerido);
    this.wizardQuorum.set(modelo.quorum);
    this.wizardSlaHours.set(modelo.slaHoras);
    this.wizardDescription.set(modelo.descricao);
    this.wizardFaixas.set(modelo.faixas.map((f) => ({ ...f, id: this.nextFaixaId() })));
    this.faixasMaximoEmBranco.set(new Set());
    this.wizardStep.set('configure');
  }

  wizardBack(): void {
    const step = this.wizardStep();
    this.wizardStep.set(step === 'configure' ? 'template' : 'choose');
  }

  updateFaixa(index: number, patch: Partial<FaixaRegraAlcada>): void {
    this.wizardFaixas.update((list) =>
      list.map((f, i) => (i === index ? { ...f, ...patch } : f)),
    );
  }

  updateFaixaValor(index: number, campo: 'valorMinimo' | 'valorMaximo', raw: unknown): void {
    const valor = raw === '' || raw === null || raw === undefined ? null : Number(raw);
    if (campo === 'valorMaximo') {
      const id = this.wizardFaixas()[index]?.id;
      if (id) this.marcarMaximoEmBranco(id, valor === null);
    }
    this.updateFaixa(index, { [campo]: valor } as Partial<FaixaRegraAlcada>);
  }

  isMaximoEmBranco(faixa: FaixaRegraAlcada): boolean {
    return faixa.valorMaximo === null && this.faixasMaximoEmBranco().has(faixa.id);
  }

  private marcarMaximoEmBranco(id: string, emBranco: boolean): void {
    this.faixasMaximoEmBranco.update((atual) => {
      if (atual.has(id) === emBranco) return atual;
      const novo = new Set(atual);
      if (emBranco) novo.add(id);
      else novo.delete(id);
      return novo;
    });
  }

  toggleSemLimite(index: number): void {
    const faixa = this.wizardFaixas()[index];
    if (!faixa) return;
    if (this.isMaximoEmBranco(faixa)) {
      this.marcarMaximoEmBranco(faixa.id, false);
      return;
    }
    if (faixa.valorMaximo === null) {
      const base = typeof faixa.valorMinimo === 'number' ? faixa.valorMinimo : 0;
      this.updateFaixa(index, { valorMaximo: base + 1000 });
    } else {
      this.updateFaixa(index, { valorMaximo: null });
    }
  }

  addFaixa(): void {
    this.wizardFaixas.update((list) => {
      const ajustada = list.map((f, i) =>
        i === list.length - 1 && f.valorMaximo === null
          ? { ...f, valorMaximo: (typeof f.valorMinimo === 'number' ? f.valorMinimo : 0) + 1000 }
          : f,
      );
      return [...ajustada, proximaFaixaRegra(ajustada, this.nextFaixaId())];
    });
  }

  removeFaixa(index: number): void {
    this.wizardFaixas.update((list) => list.filter((_, i) => i !== index));
  }

  faixaError(index: number, campo: ErroFaixaRegra['campo']): string | null {
    return (
      this.wizardFaixaErrors().find((e) => e.indice === index && e.campo === campo)?.mensagem ??
      null
    );
  }

  faixaErrors(index: number): string[] {
    return this.wizardFaixaErrors()
      .filter((e) => e.indice === index)
      .map((e) => e.mensagem);
  }

  private nextFaixaId(): string {
    this.faixaSeq += 1;
    return `faixa-${this.faixaSeq}`;
  }

  confirmCreateFromTemplate(): void {
    if (!this.canSaveWizard()) return;
    const modelo = this.selectedModelo();
    if (!modelo) return;

    const newRule = this.limitsService.createRuleFromModelo(modelo, {
      nome: this.wizardName().trim(),
      centroCusto: this.wizardCostCenter().trim(),
      quorum: this.wizardQuorum(),
      slaHoras: this.wizardSlaHours() ?? 24,
      faixas: this.wizardFaixas(),
      status: this.activateImmediately() ? 'ACTIVE' : 'DRAFT',
    });

    this.closeCreateModal();
    this.router.navigate(['/alcadas/editor', newRule.id]);
  }

  confirmCreateFromScratch(): void {
    const title = this.newRuleTitle().trim() || 'Nova Regra de Alçada';
    const newRule = this.limitsService.createRule({
      title,
      department: this.newRuleDept(),
      ceilingAmount: this.newRuleAmount(),
      quorumLabel: this.newRuleQuorum(),
      assignedTo: `Atribuído a ${this.newRuleDept()}`,
      status: this.activateImmediately() ? 'ACTIVE' : 'DRAFT',
    });

    this.closeCreateModal();
    this.router.navigate(['/alcadas/editor', newRule.id]);
  }

  confirmCreate(): void {
    if (this.wizardStep() === 'configure' || this.selectedModelo()) {
      this.confirmCreateFromTemplate();
    } else {
      this.confirmCreateFromScratch();
    }
  }

  duplicateRule(id: string, event: Event): void {
    event.stopPropagation();
    this.closeActionsMenu();
    this.limitsService.duplicateRule(id);
  }

  deleteRule(id: string, event: Event): void {
    event.stopPropagation();
    this.closeActionsMenu();
    this.limitsService.deleteRule(id);
  }

  constructor() {
    this.limitsService.loadFromBackend();
    setTimeout(() => {
      this.isLoading.set(false);
    }, 300);
  }
}
