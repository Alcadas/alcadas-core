import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { RequestsService } from '../../services/requests.service';
import { RequestCategory, RequestPriority } from '../../requests.models';

@Component({
  selector: 'app-create-request',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeaderComponent],
  templateUrl: './create-request.component.html',
  styleUrl: './create-request.component.scss',
})
export class CreateRequestComponent {
  protected readonly requestsService = inject(RequestsService);
  private readonly router = inject(Router);

  // Estado do Formulário
  readonly formTitulo = signal<string>('');
  readonly formCategoria = signal<RequestCategory>('EQUIPAMENTOS_TI');
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
      this.requestsService.createRequest({
        titulo: this.formTitulo().trim(),
        categoria: this.formCategoria(),
        centroCustoId: this.formCentroCustoId(),
        valor: this.formValor() || 0,
        prioridade: this.formPrioridade(),
        justificativa: this.formJustificativa().trim(),
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
