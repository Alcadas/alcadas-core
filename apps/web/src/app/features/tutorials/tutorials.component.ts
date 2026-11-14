import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TourService } from '../../core/services/tour.service';

export type TutorialTabType = 'solicitacoes' | 'aprovacoes' | 'alcadas' | 'organizacao';

export interface FaqItem {
  question: string;
  answer: string;
  category: string;
  isOpen?: boolean;
}

@Component({
  selector: 'app-tutorials',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tutorials.component.html',
  styleUrl: './tutorials.component.scss',
})
export class TutorialsComponent {
  private readonly router = inject(Router);
  readonly tourService = inject(TourService);

  readonly activeTab = signal<TutorialTabType>('solicitacoes');
  readonly searchQuery = signal<string>('');

  // Simulador de Esteira de Alçada
  readonly simValue = signal<number>(15000);
  readonly simCategory = signal<string>('TI');

  readonly simulatedPath = computed(() => {
    const val = this.simValue();
    if (val <= 10000) {
      return {
        levels: ['Solicitante', 'Gerente Aprovador'],
        description: 'Alçada Operacional: requer aprovação imediata do Gestor Direto da área.',
        color: '#10b981',
      };
    } else if (val <= 50000) {
      return {
        levels: ['Solicitante', 'Gerente Aprovador', 'Diretor da Área'],
        description: 'Alçada Estratégica: requer validação em 2 níveis (Gerente + Diretor Executivo).',
        color: '#644ef3',
      };
    } else {
      return {
        levels: ['Solicitante', 'Gerente Aprovador', 'Diretor da Área', 'CFO / Comitê Financeiro'],
        description: 'Alta Governança: requer colegiado financeiro e parecer do CFO da empresa.',
        color: '#d97706',
      };
    }
  });

  // Lista de Perguntas Frequentes
  readonly faqs = signal<FaqItem[]>([
    {
      question: 'O que acontece se meu pedido ultrapassar o limite de alçada do meu gerente?',
      answer: 'O motor de regras encaminha automaticamente o pedido para o próximo nível hierárquico da esteira (por exemplo, Diretor Executivo ou CFO). O gerente inicial faz a validação e o diretor dá a deliberação final.',
      category: 'Alçadas & Limites',
      isOpen: false,
    },
    {
      question: 'Posso aprovar uma solicitação que eu mesmo abri?',
      answer: 'Não. Por estrita política de Segregação de Funções (SoD - Segregation of Duties) e conformidade corporativa, nenhum usuário pode autorizar desembolsos de seus próprios pedidos.',
      category: 'Segurança & SoD',
      isOpen: false,
    },
    {
      question: 'Como funciona a assinatura digital criptográfica com SHA-256?',
      answer: 'Ao deliberar (aprovar/rejeitar), o sistema combina os dados da solicitação, o carimbo de data/hora (timestamp) e a chave do aprovador para gerar um hash SHA-256 único, garantindo não-repúdio e inviolabilidade.',
      category: 'Segurança & Auditoria',
      isOpen: false,
    },
    {
      question: 'O que devo fazer quando um pedido é devolvido para ajuste?',
      answer: 'Acesse a Central de Solicitações, localize o pedido com status "Ajuste Solicitado", leia as observações deixadas pelo aprovador no parecer, ajuste os valores ou novos anexos e reenvie para a esteira.',
      category: 'Solicitações',
      isOpen: false,
    },
    {
      question: 'Como adicionar novos colaboradores e definir seus tetos de aprovação?',
      answer: 'Administradores e Diretores podem acessar "Configurações > Organização > Funcionários" para cadastrar novos colaboradores, definir o centro de custo e estipular o limite individual em R$.',
      category: 'Organização',
      isOpen: false,
    },
  ]);

  readonly filteredFaqs = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return this.faqs();
    return this.faqs().filter(
      (f) =>
        f.question.toLowerCase().includes(q) ||
        f.answer.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q),
    );
  });

  selectTab(tab: TutorialTabType): void {
    this.activeTab.set(tab);
  }

  toggleFaq(index: number): void {
    this.faqs.update((list) =>
      list.map((item, idx) =>
        idx === index ? { ...item, isOpen: !item.isOpen } : item,
      ),
    );
  }

  iniciarTourContextual(context: string): void {
    this.tourService.startTour(context);
  }

  irParaTela(rota: string): void {
    void this.router.navigate([rota]);
  }
}
