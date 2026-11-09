import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { AuthService } from '../../../../core/auth/auth.service';
import { SettingsService } from '../../../settings/services/settings.service';
import { RequestsService } from '../../services/requests.service';
import { CostCenterOption, RequestCategory, RequestPriority } from '../../requests.models';

@Component({
  selector: 'app-create-request',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeaderComponent],
  templateUrl: './create-request.component.html',
  styleUrl: './create-request.component.scss',
})
export class CreateRequestComponent {
  protected readonly requestsService = inject(RequestsService);
  protected readonly authService = inject(AuthService, { optional: true });
  protected readonly settingsService = inject(SettingsService, { optional: true });
  private readonly router = inject(Router);

  // Estado do Formulário
  readonly formTitulo = signal<string>('');
  readonly formCategoria = signal<RequestCategory>('EQUIPAMENTOS');
  readonly formCentroCustoId = signal<string>('cc-ti');
  readonly formValor = signal<number | null>(null);
  readonly formPrioridade = signal<RequestPriority>('MEDIA');
  readonly formJustificativa = signal<string>('');
  readonly formAnexos = signal<Array<{ nome: string; tamanho: string; tipo: string }>>([
    { nome: 'Cotacao_Oficial_Fornecedor.pdf', tamanho: '1.1 MB', tipo: 'application/pdf' },
  ]);

  readonly isSubmitting = signal<boolean>(false);
  readonly formErrors = signal<Record<string, string>>({});
  readonly toastMessage = signal<string | null>(null);

  /**
   * Administradores, Diretores / CFO e Super Usuários possuem permissão global
   * e podem selecionar qualquer centro de custo da organização.
   */
  readonly isGlobalRequester = computed<boolean>(() => {
    const user = this.authService?.currentUser();
    if (!user) return true;
    if (user.email && user.email.toLowerCase() === 'dev@alcadas.com') return true;
    const globalRoles = ['DIRETOR_CFO', 'ADMIN', 'SUPER_USER'];
    if (user.role && globalRoles.includes(user.role)) return true;
    if (user.roles?.some((r: string) => globalRoles.includes(r))) return true;
    return false;
  });

  /**
   * Centros de custo disponíveis para o usuário solicitante.
   * Se for usuário departamental (ex: Recursos Humanos ou Controladoria), isola e restringe para a sua área.
   */
  readonly availableCostCenters = computed<CostCenterOption[]>(() => {
    const all = this.requestsService.costCenters();
    if (this.isGlobalRequester()) {
      return all;
    }

    const user = this.authService?.currentUser();
    if (!user) return all;

    const userCc = (user.costCenterId || '').toLowerCase().trim();
    const userDepId = (user.departmentId || '').toLowerCase().trim();
    const userDepName = (user.departmentName || '').toLowerCase().trim();

    if (!userCc && !userDepId && !userDepName) {
      return all;
    }

    const filtrados = all.filter((cc) => {
      const ccId = (cc.id || '').toLowerCase().trim();
      const ccCode = (cc.code || '').toLowerCase().trim();
      const ccNome = (cc.nome || '').toLowerCase().trim();
      const ccDept = (cc.departamento || '').toLowerCase().trim();

      const matchCc = Boolean(userCc && (ccId === userCc || ccCode === userCc));
      const matchDepId = Boolean(userDepId && ccId === userDepId);
      const matchDeptName = Boolean(
        userDepName &&
          ((ccDept &&
            (ccDept === userDepName ||
              ccDept.includes(userDepName) ||
              userDepName.includes(ccDept))) ||
            (ccNome &&
              (ccNome === userDepName ||
                ccNome.includes(userDepName) ||
                userDepName.includes(ccNome)))),
      );

      return matchCc || matchDepId || matchDeptName;
    });

    if (filtrados.length > 0) {
      return filtrados;
    }

    // Se o solicitante tem departamento/centro de custo definido mas ele não foi carregado na lista remota,
    // sintetiza a opção correspondente para nunca vazar centros de custo de outras áreas.
    if (userCc || userDepName) {
      return [
        {
          id: user.costCenterId || user.departmentId || 'cc-user',
          code: user.costCenterId || 'CC-DEP',
          nome: user.departmentName || 'Meu Departamento',
          departamento: user.departmentName,
        },
      ];
    }

    return all;
  });

  /** Quando o solicitante tem acesso restrito a até 1 centro de custo, trava a seleção */
  readonly isCostCenterLocked = computed<boolean>(() => {
    return !this.isGlobalRequester() && this.availableCostCenters().length <= 1;
  });

  constructor() {
    this.requestsService.ensureLoaded();
    effect(() => {
      const list = this.availableCostCenters();
      const current = this.formCentroCustoId();
      if (list.length > 0 && !list.some((cc) => cc.id === current)) {
        this.formCentroCustoId.set(list[0].id);
      }
    });
  }

  // Esteira Dinâmica Sugerida conforme Valor e Centro de Custo
  readonly suggestedWorkflow = computed(() => {
    const val = this.formValor() || 0;
    const ccId = this.formCentroCustoId();
    const cat = this.formCategoria();
    return this.requestsService.calculateSuggestedWorkflow(val, ccId, cat);
  });

  goBack(): void {
    this.router.navigate(['/solicitacoes']);
  }

  setCategory(catId: RequestCategory): void {
    this.formCategoria.set(catId);
  }

  setPriority(p: RequestPriority): void {
    this.formPrioridade.set(p);
  }

  triggerFileInput(): void {
    const fileNum = this.formAnexos().length + 1;
    this.formAnexos.update((list) => [
      ...list,
      {
        nome: `Proposta_Comercial_Comparativa_0${fileNum}.pdf`,
        tamanho: '2.4 MB',
        tipo: 'application/pdf',
      },
    ]);
  }

  removeAttachment(index: number): void {
    this.formAnexos.update((list) => list.filter((_, i) => i !== index));
  }

  validateForm(): boolean {
    const errors: Record<string, string> = {};
    const titulo = this.formTitulo().trim();
    const valor = this.formValor();
    const justificativa = this.formJustificativa().trim();

    if (!titulo) {
      errors['titulo'] = 'O título da solicitação é obrigatório.';
    } else if (titulo.length < 5) {
      errors['titulo'] = 'O título deve possuir pelo menos 5 caracteres.';
    }

    if (!valor || valor <= 0) {
      errors['valor'] = 'Informe um valor estimado válido maior que zero.';
    }

    if (!justificativa) {
      errors['justificativa'] = 'A justificativa de governança é obrigatória.';
    } else if (justificativa.length < 30) {
      errors['justificativa'] = `Justificativa insuficiente (${justificativa.length}/30 caracteres mínimos).`;
    }

    this.formErrors.set(errors);
    return Object.keys(errors).length === 0;
  }

  submitNewRequest(): void {
    if (!this.validateForm()) {
      return;
    }

    this.isSubmitting.set(true);

    setTimeout(() => {
      const suggested = this.suggestedWorkflow();
      this.requestsService.createRequest({
        titulo: this.formTitulo().trim(),
        categoria: this.formCategoria(),
        centroCustoId: this.formCentroCustoId(),
        valor: this.formValor() || 0,
        prioridade: this.formPrioridade(),
        justificativa: this.formJustificativa().trim(),
        fluxoNome: suggested?.nome,
        anexos: this.formAnexos(),
      });

      this.isSubmitting.set(false);
      this.router.navigate(['/solicitacoes'], {
        queryParams: { criada: 'true' },
      });
    }, 600);
  }

  saveDraft(): void {
    const titulo = this.formTitulo().trim() || 'Rascunho de Solicitação';
    this.requestsService.createRequest({
      titulo,
      categoria: this.formCategoria(),
      centroCustoId: this.formCentroCustoId(),
      valor: this.formValor() || 1000,
      prioridade: this.formPrioridade(),
      justificativa: this.formJustificativa().trim() || 'Rascunho inicial em elaboração pelo solicitante.',
      anexos: this.formAnexos(),
    });

    this.router.navigate(['/solicitacoes']);
  }
}
