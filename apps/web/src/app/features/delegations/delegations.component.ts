import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

// ---------- Tipos ----------

export interface Funcionalidade {
  chave: string;
  label: string;
}

export interface Profissao {
  id: number;
  nome: string;
  funcionalidades: string[];
}

export interface Perfil {
  id: number;
  nome: string;
  email: string;
  profissaoId: number;
}

// ---------- Dados de exemplo (mock) ----------

// Funcionalidades = telas do menu lateral do sistema.
const FUNCIONALIDADES: Funcionalidade[] = [
  { chave: 'dashboard', label: 'Dashboard' },
  { chave: 'minhas_aprovacoes', label: 'Minhas Aprovações' },
  { chave: 'solicitacoes', label: 'Solicitações' },
  { chave: 'meus_fluxos', label: 'Meus Fluxos' },
  { chave: 'minhas_regras', label: 'Minhas Regras' },
  { chave: 'trilha', label: 'Trilha Criptográfica' },
  { chave: 'motor_riscos', label: 'Motor de Riscos' },
  { chave: 'delegacoes', label: 'Delegações & SoD' },
];

const PROFISSOES_EXEMPLO: Profissao[] = [
  {
    id: 1,
    nome: 'Diretor',
    funcionalidades: ['dashboard', 'minhas_aprovacoes', 'solicitacoes', 'trilha', 'delegacoes'],
  },
  { id: 2, nome: 'Engenheiro', funcionalidades: ['solicitacoes'] },
  {
    id: 3,
    nome: 'Administrador',
    funcionalidades: ['dashboard', 'solicitacoes', 'meus_fluxos', 'minhas_regras'],
  },
  { id: 4, nome: 'Auditor', funcionalidades: ['dashboard', 'trilha'] },
];

const PERFIS_EXEMPLO: Perfil[] = [
  { id: 1, nome: 'Ana Souza', email: 'ana.souza@email.com', profissaoId: 2 },
  { id: 2, nome: 'Carlos Lima', email: 'carlos.lima@email.com', profissaoId: 3 },
  { id: 3, nome: 'Mariana Alves', email: 'mariana.alves@email.com', profissaoId: 1 },
  { id: 4, nome: 'João Pereira', email: 'joao.pereira@email.com', profissaoId: 4 },
  { id: 5, nome: 'Beatriz Rocha', email: 'beatriz.rocha@email.com', profissaoId: 2 },
  { id: 6, nome: 'Rafael Costa', email: 'rafael.costa@email.com', profissaoId: 2 },
];

// Cores usadas nas etiquetas das profissões (repete se tiver mais profissões)
const CLASSES_BADGE = ['cor-1', 'cor-2', 'cor-3', 'cor-4', 'cor-5'];

const ITENS_POR_PAGINA = 5;

@Component({
  selector: 'app-delegations',
  standalone: true,
  imports: [FormsModule, PageHeaderComponent],
  template: `
    <app-page-header
      breadcrumbRoot="Governança"
      breadcrumbCurrent="Delegações"
      searchPlaceholder="Buscar substitutos ou cargos..."
      contextIcon="group"
      contextTitle="Delegações & Segregação de Funções (SoD)"
      contextSubtitle="Gestão de substitutos temporários com controle de conflito de papéis"
    >
      <div header-actions class="header-actions-group">
        <button type="button" class="btn-header-primary" (click)="abrirNovoPerfil()">
          <span class="material-symbols-rounded">add</span>
          <span>Novo Perfil</span>
        </button>
      </div>
    </app-page-header>

    <div class="page-content">

      <!-- ================= TABELA 1: PROFISSÕES ================= -->
      <div class="card">
        <div class="card-titulo">
          <div>
            <h3>Profissões e permissões</h3>
            <p>Marque as funcionalidades do site que cada profissão pode acessar</p>
          </div>
          <button type="button" class="btn-primario" (click)="abrirNovaProfissao()">
            Nova Profissão
          </button>
        </div>

        @if (profissoes.length === 0) {
          <div class="vazio">Nenhuma profissão cadastrada ainda.</div>
        } @else {
          <div class="tabela-scroll">
            <table class="tabela tabela-checks">
              <thead>
                <tr>
                  <th>Profissão</th>
                  @for (f of funcionalidades; track f.chave) {
                    <th class="col-check">{{ f.label }}</th>
                  }
                  <th class="col-acoes">Ações</th>
                </tr>
              </thead>
              <tbody>
                @for (prof of profissoes; track prof.id) {
                  <tr>
                    <td>
                      <span [class]="'badge ' + classeDaProfissao(prof.id)">{{ prof.nome }}</span>
                    </td>
                    @for (f of funcionalidades; track f.chave) {
                      <td class="col-check">
                        <input
                          type="checkbox"
                          [checked]="temFuncionalidade(prof, f.chave)"
                          (change)="alternarFuncionalidade(prof, f.chave)"
                        />
                      </td>
                    }
                    <td class="col-acoes">
                      <button type="button" class="btn-icone" title="Renomear" (click)="abrirEdicaoProfissao(prof)">
                        <span class="material-symbols-rounded">edit</span>
                      </button>
                      <button type="button" class="btn-icone perigo" title="Excluir" (click)="pedirExclusaoProfissao(prof)">
                        <span class="material-symbols-rounded">delete</span>
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>

      <!-- ================= TABELA 2: PESSOAS ================= -->
      <div class="card">
        <div class="card-titulo">
          <div>
            <h3>Pessoas e profissões</h3>
            <p>Quem trabalha na empresa e qual profissão cada pessoa tem</p>
          </div>
          <span class="contador">{{ perfis.length }} perfis</span>
        </div>

        @if (perfis.length === 0) {
          <div class="vazio">Nenhum perfil cadastrado ainda.</div>
        } @else {
          <table class="tabela">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Profissão</th>
                <th class="col-acoes">Ações</th>
              </tr>
            </thead>
            <tbody>
              @for (perfil of perfisDaPagina; track perfil.id) {
                <tr>
                  <td>
                    <div class="pessoa">
                      <span class="avatar">{{ iniciais(perfil.nome) }}</span>
                      <span class="nome">{{ perfil.nome }}</span>
                    </div>
                  </td>
                  <td>{{ perfil.email }}</td>
                  <td>
                    <span [class]="'badge ' + classeDaProfissao(perfil.profissaoId)">{{ nomeDaProfissao(perfil.profissaoId) }}</span>
                  </td>
                  <td class="col-acoes">
                    <button type="button" class="btn-icone" title="Ver permissões" (click)="abrirVisualizacao(perfil)">
                      <span class="material-symbols-rounded">visibility</span>
                    </button>
                    <button type="button" class="btn-icone" title="Editar" (click)="abrirEdicaoPerfil(perfil)">
                      <span class="material-symbols-rounded">edit</span>
                    </button>
                    <button type="button" class="btn-icone perigo" title="Excluir" (click)="pedirExclusaoPerfil(perfil)">
                      <span class="material-symbols-rounded">delete</span>
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>

          <div class="rodape-tabela">
            <span class="info-pagina">{{ textoMostrando }}</span>
            <div class="paginacao">
              <button type="button" class="btn-pagina" [disabled]="pagina === 1" (click)="mudarPagina(pagina - 1)">
                <span class="material-symbols-rounded">chevron_left</span>
              </button>
              <span class="pagina-atual">{{ pagina }}</span>
              <button type="button" class="btn-pagina" [disabled]="pagina === totalPaginas" (click)="mudarPagina(pagina + 1)">
                <span class="material-symbols-rounded">chevron_right</span>
              </button>
            </div>
          </div>
        }
      </div>
    </div>

    <!-- ================= MODAL: PROFISSÃO (criar / renomear) ================= -->
    @if (modalProfissaoAberto) {
      <div class="modal-fundo" (click)="fecharModais()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h2>{{ editandoProfissaoId === null ? 'Nova Profissão' : 'Editar Profissão' }}</h2>

          <label class="campo">
            Nome da profissão
            <input type="text" [(ngModel)]="nomeProfissao" placeholder="Ex: Diretor" />
          </label>

          <div class="campo">
            Funcionalidades que ela pode ter
            <div class="lista-checks">
              @for (f of funcionalidades; track f.chave) {
                <label class="check">
                  <input
                    type="checkbox"
                    [checked]="estaMarcadaNoForm(f.chave)"
                    (change)="alternarNoForm(f.chave)"
                  />
                  {{ f.label }}
                </label>
              }
            </div>
          </div>

          @if (erro !== '') {
            <div class="erro">{{ erro }}</div>
          }

          <div class="modal-botoes">
            <button type="button" class="btn-secundario" (click)="fecharModais()">Cancelar</button>
            <button type="button" class="btn-primario" (click)="salvarProfissao()">Salvar</button>
          </div>
        </div>
      </div>
    }

    <!-- ================= MODAL: PERFIL (criar / editar) ================= -->
    @if (modalPerfilAberto) {
      <div class="modal-fundo" (click)="fecharModais()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h2>{{ editandoPerfilId === null ? 'Novo Perfil' : 'Editar Perfil' }}</h2>

          <label class="campo">
            Nome
            <input type="text" [(ngModel)]="nome" placeholder="Ex: Ana Souza" />
          </label>

          <label class="campo">
            Email
            <input type="text" [(ngModel)]="email" placeholder="Ex: ana@email.com" />
          </label>

          <label class="campo">
            Profissão
            <select [(ngModel)]="profissaoId">
              <option [ngValue]="null">Selecione uma profissão</option>
              @for (prof of profissoes; track prof.id) {
                <option [ngValue]="prof.id">{{ prof.nome }}</option>
              }
            </select>
          </label>

          @if (erro !== '') {
            <div class="erro">{{ erro }}</div>
          }

          <div class="modal-botoes">
            <button type="button" class="btn-secundario" (click)="fecharModais()">Cancelar</button>
            <button type="button" class="btn-primario" (click)="salvarPerfil()">
              {{ editandoPerfilId === null ? 'Criar Perfil' : 'Salvar Alterações' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ================= MODAL: VER PERMISSÕES DA PESSOA ================= -->
    @if (perfilVisualizado !== null) {
      <div class="modal-fundo" (click)="fecharModais()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h2>{{ perfilVisualizado.nome }}</h2>
          <p class="sub">{{ perfilVisualizado.email }}</p>

          <div class="campo">
            Profissão
            <span [class]="'badge ' + classeDaProfissao(perfilVisualizado.profissaoId)">{{ nomeDaProfissao(perfilVisualizado.profissaoId) }}</span>
          </div>

          <div class="campo">
            Funcionalidades liberadas
            <ul class="lista-permissoes">
              @for (label of funcionalidadesDaProfissao(perfilVisualizado.profissaoId); track label) {
                <li>
                  <span class="material-symbols-rounded check-icone">check_circle</span>
                  {{ label }}
                </li>
              } @empty {
                <li>Nenhuma funcionalidade liberada.</li>
              }
            </ul>
          </div>

          <div class="modal-botoes">
            <button type="button" class="btn-secundario" (click)="fecharModais()">Fechar</button>
          </div>
        </div>
      </div>
    }

    <!-- ================= MODAL: EXCLUIR PERFIL ================= -->
    @if (perfilParaExcluir !== null) {
      <div class="modal-fundo" (click)="fecharModais()">
        <div class="modal modal-confirma" (click)="$event.stopPropagation()">
          <span class="material-symbols-rounded icone-lixeira">delete</span>
          <h2>Tem certeza que deseja deletar este perfil?</h2>
          <p class="sub">{{ perfilParaExcluir.nome }}. Essa ação não pode ser desfeita.</p>
          <div class="modal-botoes centro">
            <button type="button" class="btn-secundario" (click)="fecharModais()">Cancelar</button>
            <button type="button" class="btn-perigo" (click)="confirmarExclusaoPerfil()">Deletar</button>
          </div>
        </div>
      </div>
    }

    <!-- ================= MODAL: EXCLUIR PROFISSÃO ================= -->
    @if (profissaoParaExcluir !== null) {
      <div class="modal-fundo" (click)="fecharModais()">
        <div class="modal modal-confirma" (click)="$event.stopPropagation()">
          <span class="material-symbols-rounded icone-lixeira">delete</span>
          @if (pessoasComProfissao(profissaoParaExcluir.id) > 0) {
            <h2>Não é possível deletar esta profissão</h2>
            <p class="sub">
              {{ pessoasComProfissao(profissaoParaExcluir.id) }} pessoa(s) ainda têm a profissão
              {{ profissaoParaExcluir.nome }}. Troque a profissão delas antes.
            </p>
            <div class="modal-botoes centro">
              <button type="button" class="btn-secundario" (click)="fecharModais()">Fechar</button>
            </div>
          } @else {
            <h2>Tem certeza que deseja deletar esta profissão?</h2>
            <p class="sub">{{ profissaoParaExcluir.nome }}. Essa ação não pode ser desfeita.</p>
            <div class="modal-botoes centro">
              <button type="button" class="btn-secundario" (click)="fecharModais()">Cancelar</button>
              <button type="button" class="btn-perigo" (click)="confirmarExclusaoProfissao()">Deletar</button>
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; width: 100%; min-width: 0; overflow: hidden; }
    .header-actions-group {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .page-content { flex: 1; padding: 2rem; overflow-y: auto; }

    .card {
      background: #ffffff; border: 1px solid #eef2f6; border-radius: 16px; padding: 1.75rem;
      max-width: 1100px; margin: 0 auto 1.5rem; box-shadow: 0 4px 16px rgba(0,0,0,0.02);
    }
    .card-titulo {
      display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem;
    }
    h3 { margin: 0 0 0.25rem; color: #0f172a; font-size: 1.15rem; font-weight: 700; }
    p { margin: 0; color: #64748b; font-size: 0.85rem; }
    .contador {
      font-size: 0.8rem; font-weight: 600; color: #644EF3; background: #f1eeff;
      padding: 4px 10px; border-radius: 999px;
    }
    .vazio { text-align: center; color: #64748b; font-size: 0.85rem; padding: 2rem 0; }

    .tabela-scroll { overflow-x: auto; }
    .tabela { width: 100%; border-collapse: collapse; font-size: 0.85rem; color: #0f172a; }
    .tabela th {
      text-align: left; padding: 0.6rem 0.5rem; color: #64748b; font-weight: 600;
      border-bottom: 1px solid #eef2f6;
    }
    .tabela td { padding: 0.75rem 0.5rem; border-bottom: 1px solid #eef2f6; vertical-align: middle; }
    .tabela-checks th.col-check { font-size: 0.72rem; text-align: center; min-width: 78px; }
    .col-check { text-align: center; }
    .col-check input { width: 16px; height: 16px; accent-color: #644EF3; cursor: pointer; }
    .tabela th.col-acoes, .tabela td.col-acoes { text-align: right; white-space: nowrap; width: 110px; }

    .pessoa { display: flex; align-items: center; gap: 0.65rem; }
    .nome { font-weight: 600; }
    .avatar {
      width: 34px; height: 34px; border-radius: 50%; background: #f1eeff; color: #644EF3;
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 0.75rem; font-weight: 700;
    }

    .badge {
      display: inline-block; font-size: 0.75rem; font-weight: 600;
      padding: 3px 10px; border-radius: 999px;
    }
    .cor-1 { background: #f1eeff; color: #644EF3; }
    .cor-2 { background: #e0f2fe; color: #0369a1; }
    .cor-3 { background: #dcfce7; color: #15803d; }
    .cor-4 { background: #fef3c7; color: #b45309; }
    .cor-5 { background: #fce7f3; color: #be185d; }

    .btn-icone {
      background: none; border: none; cursor: pointer; color: #64748b; padding: 4px;
      border-radius: 6px; vertical-align: middle;
    }
    .btn-icone:hover { background: #f1eeff; color: #644EF3; }
    .btn-icone.perigo:hover { background: #fef2f2; color: #dc2626; }
    .btn-icone .material-symbols-rounded { font-size: 20px; }

    .rodape-tabela {
      display: flex; justify-content: space-between; align-items: center; margin-top: 1rem;
    }
    .info-pagina { font-size: 0.8rem; color: #64748b; }
    .paginacao { display: flex; align-items: center; gap: 0.4rem; }
    .btn-pagina {
      background: #ffffff; border: 1px solid #eef2f6; border-radius: 8px; cursor: pointer;
      padding: 2px; display: inline-flex; color: #0f172a;
    }
    .btn-pagina:disabled { opacity: 0.4; cursor: default; }
    .pagina-atual {
      background: #644EF3; color: #ffffff; font-size: 0.8rem; font-weight: 600;
      min-width: 28px; text-align: center; padding: 4px 0; border-radius: 8px;
    }

    .btn-primario {
      background: #644EF3; color: #ffffff; border: none; border-radius: 10px;
      padding: 0.6rem 1.1rem; font-size: 0.85rem; font-weight: 600; cursor: pointer;
    }
    .btn-primario:hover { background: #5640dd; }
    .btn-secundario {
      background: #ffffff; color: #0f172a; border: 1px solid #BDB4FC; border-radius: 10px;
      padding: 0.6rem 1.1rem; font-size: 0.85rem; font-weight: 600; cursor: pointer;
    }
    .btn-perigo {
      background: #ef4444; color: #ffffff; border: none; border-radius: 10px;
      padding: 0.6rem 1.1rem; font-size: 0.85rem; font-weight: 600; cursor: pointer;
    }
    .btn-perigo:hover { background: #dc2626; }

    .modal-fundo {
      position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45); z-index: 1000;
      display: flex; align-items: center; justify-content: center; padding: 1rem;
    }
    .modal {
      background: #ffffff; border-radius: 16px; padding: 1.75rem; width: 100%; max-width: 460px;
    }
    .modal h2 { margin: 0 0 0.25rem; font-size: 1.15rem; color: #0f172a; }
    .sub { margin-bottom: 1.1rem; }
    .modal-confirma { text-align: center; max-width: 400px; }
    .modal-confirma h2 { margin-top: 0.5rem; }
    .icone-lixeira { font-size: 40px; color: #ef4444; }

    .campo {
      display: flex; flex-direction: column; gap: 6px; margin-top: 1rem;
      font-size: 0.85rem; font-weight: 600; color: #0f172a;
    }
    .campo input[type='text'], .campo select {
      border: 1px solid #eef2f6; border-radius: 8px; padding: 0.6rem 0.75rem;
      font-size: 0.85rem; font-weight: 400; color: #0f172a; background: #ffffff;
    }
    .campo input[type='text']:focus, .campo select:focus { outline: none; border-color: #644EF3; }
    .campo .badge { align-self: flex-start; }

    .lista-permissoes { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
    .lista-permissoes li {
      display: flex; align-items: center; gap: 8px; font-weight: 400; font-size: 0.85rem;
    }
    .check-icone { font-size: 18px; color: #10b981; }

    .lista-checks { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
    .check { display: flex; align-items: center; gap: 8px; font-weight: 400; font-size: 0.85rem; }
    .check input { width: 16px; height: 16px; accent-color: #644EF3; }

    .erro { color: #dc2626; font-size: 0.8rem; margin-top: 0.75rem; }
    .modal-botoes { display: flex; justify-content: flex-end; gap: 0.6rem; margin-top: 1.4rem; }
    .modal-botoes.centro { justify-content: center; }
  `]
})
export class DelegationsComponent {
  funcionalidades = FUNCIONALIDADES;
  profissoes: Profissao[] = PROFISSOES_EXEMPLO;
  perfis: Perfil[] = PERFIS_EXEMPLO;

  // paginação da tabela de pessoas
  pagina = 1;

  // modais
  modalProfissaoAberto = false;
  modalPerfilAberto = false;
  perfilVisualizado: Perfil | null = null;
  perfilParaExcluir: Perfil | null = null;
  profissaoParaExcluir: Profissao | null = null;

  // formulário de profissão
  editandoProfissaoId: number | null = null;
  nomeProfissao = '';
  checksDoForm: string[] = [];

  // formulário de perfil (pessoa)
  editandoPerfilId: number | null = null;
  nome = '';
  email = '';
  profissaoId: number | null = null;

  erro = '';

  // ---------- Métodos auxiliares ----------

  iniciais(nomeCompleto: string): string {
    const partes = nomeCompleto.trim().split(' ');
    const primeira = partes[0] ? partes[0][0] : '';
    const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
    return (primeira + ultima).toUpperCase();
  }

  nomeDaProfissao(id: number): string {
    const achada = this.profissoes.find((p) => p.id === id);
    return achada ? achada.nome : 'Sem profissão';
  }

  classeDaProfissao(id: number): string {
    const posicao = this.profissoes.findIndex((p) => p.id === id);
    if (posicao < 0) {
      return '';
    }
    return CLASSES_BADGE[posicao % CLASSES_BADGE.length];
  }

  funcionalidadesDaProfissao(id: number): string[] {
    const achada = this.profissoes.find((p) => p.id === id);
    if (!achada) {
      return [];
    }
    return this.funcionalidades
      .filter((f) => achada.funcionalidades.includes(f.chave))
      .map((f) => f.label);
  }

  pessoasComProfissao(id: number): number {
    return this.perfis.filter((p) => p.profissaoId === id).length;
  }

  // ---------- Tabela de profissões ----------

  temFuncionalidade(prof: Profissao, chave: string): boolean {
    return prof.funcionalidades.includes(chave);
  }

  alternarFuncionalidade(prof: Profissao, chave: string): void {
    this.profissoes = this.profissoes.map((p) => {
      if (p.id !== prof.id) {
        return p;
      }
      if (p.funcionalidades.includes(chave)) {
        return { ...p, funcionalidades: p.funcionalidades.filter((c) => c !== chave) };
      }
      return { ...p, funcionalidades: [...p.funcionalidades, chave] };
    });
  }

  abrirNovaProfissao(): void {
    this.editandoProfissaoId = null;
    this.nomeProfissao = '';
    this.checksDoForm = [];
    this.erro = '';
    this.modalProfissaoAberto = true;
  }

  abrirEdicaoProfissao(prof: Profissao): void {
    this.editandoProfissaoId = prof.id;
    this.nomeProfissao = prof.nome;
    this.checksDoForm = [...prof.funcionalidades];
    this.erro = '';
    this.modalProfissaoAberto = true;
  }

  estaMarcadaNoForm(chave: string): boolean {
    return this.checksDoForm.includes(chave);
  }

  alternarNoForm(chave: string): void {
    if (this.estaMarcadaNoForm(chave)) {
      this.checksDoForm = this.checksDoForm.filter((c) => c !== chave);
    } else {
      this.checksDoForm = [...this.checksDoForm, chave];
    }
  }

  salvarProfissao(): void {
    const nomeLimpo = this.nomeProfissao.trim();

    if (nomeLimpo === '') {
      this.erro = 'Informe o nome da profissão.';
      return;
    }
    const repetida = this.profissoes.some(
      (p) => p.nome.toLowerCase() === nomeLimpo.toLowerCase() && p.id !== this.editandoProfissaoId
    );
    if (repetida) {
      this.erro = 'Já existe uma profissão com esse nome.';
      return;
    }

    if (this.editandoProfissaoId === null) {
      const novoId = this.profissoes.length > 0 ? Math.max(...this.profissoes.map((p) => p.id)) + 1 : 1;
      this.profissoes = [
        ...this.profissoes,
        { id: novoId, nome: nomeLimpo, funcionalidades: this.checksDoForm },
      ];
    } else {
      this.profissoes = this.profissoes.map((p) =>
        p.id === this.editandoProfissaoId
          ? { ...p, nome: nomeLimpo, funcionalidades: this.checksDoForm }
          : p
      );
    }
    this.fecharModais();
  }

  pedirExclusaoProfissao(prof: Profissao): void {
    this.profissaoParaExcluir = prof;
  }

  confirmarExclusaoProfissao(): void {
    if (this.profissaoParaExcluir !== null) {
      const idExcluido = this.profissaoParaExcluir.id;
      this.profissoes = this.profissoes.filter((p) => p.id !== idExcluido);
    }
    this.fecharModais();
  }

  // ---------- Tabela de pessoas: paginação ----------

  get totalPaginas(): number {
    const total = Math.ceil(this.perfis.length / ITENS_POR_PAGINA);
    return total > 0 ? total : 1;
  }

  get perfisDaPagina(): Perfil[] {
    const inicio = (this.pagina - 1) * ITENS_POR_PAGINA;
    return this.perfis.slice(inicio, inicio + ITENS_POR_PAGINA);
  }

  get textoMostrando(): string {
    if (this.perfis.length === 0) {
      return '';
    }
    const inicio = (this.pagina - 1) * ITENS_POR_PAGINA + 1;
    const fim = inicio + this.perfisDaPagina.length - 1;
    return 'Mostrando ' + inicio + '-' + fim + ' de ' + this.perfis.length + ' perfis';
  }

  mudarPagina(nova: number): void {
    if (nova >= 1 && nova <= this.totalPaginas) {
      this.pagina = nova;
    }
  }

  // ---------- Tabela de pessoas: ações ----------

  abrirNovoPerfil(): void {
    this.editandoPerfilId = null;
    this.nome = '';
    this.email = '';
    this.profissaoId = null;
    this.erro = '';
    this.modalPerfilAberto = true;
  }

  abrirEdicaoPerfil(perfil: Perfil): void {
    this.editandoPerfilId = perfil.id;
    this.nome = perfil.nome;
    this.email = perfil.email;
    this.profissaoId = perfil.profissaoId;
    this.erro = '';
    this.modalPerfilAberto = true;
  }

  abrirVisualizacao(perfil: Perfil): void {
    this.perfilVisualizado = perfil;
  }

  pedirExclusaoPerfil(perfil: Perfil): void {
    this.perfilParaExcluir = perfil;
  }

  salvarPerfil(): void {
    const nomeLimpo = this.nome.trim();
    const emailLimpo = this.email.trim().toLowerCase();

    if (nomeLimpo === '') {
      this.erro = 'Informe o nome.';
      return;
    }
    if (emailLimpo === '' || !emailLimpo.includes('@') || !emailLimpo.includes('.')) {
      this.erro = 'Informe um email válido.';
      return;
    }
    if (this.profissaoId === null) {
      this.erro = 'Selecione uma profissão.';
      return;
    }
    const emailRepetido = this.perfis.some(
      (p) => p.email.toLowerCase() === emailLimpo && p.id !== this.editandoPerfilId
    );
    if (emailRepetido) {
      this.erro = 'Já existe um perfil com esse email.';
      return;
    }

    const idDaProfissao: number = this.profissaoId;

    if (this.editandoPerfilId === null) {
      const novoId = this.perfis.length > 0 ? Math.max(...this.perfis.map((p) => p.id)) + 1 : 1;
      this.perfis = [
        ...this.perfis,
        { id: novoId, nome: nomeLimpo, email: emailLimpo, profissaoId: idDaProfissao },
      ];
    } else {
      this.perfis = this.perfis.map((p) =>
        p.id === this.editandoPerfilId
          ? { ...p, nome: nomeLimpo, email: emailLimpo, profissaoId: idDaProfissao }
          : p
      );
    }
    this.fecharModais();
  }

  confirmarExclusaoPerfil(): void {
    if (this.perfilParaExcluir !== null) {
      const idExcluido = this.perfilParaExcluir.id;
      this.perfis = this.perfis.filter((p) => p.id !== idExcluido);
      if (this.pagina > this.totalPaginas) {
        this.pagina = this.totalPaginas;
      }
    }
    this.fecharModais();
  }

  // ---------- Comum ----------

  fecharModais(): void {
    this.modalProfissaoAberto = false;
    this.modalPerfilAberto = false;
    this.perfilVisualizado = null;
    this.perfilParaExcluir = null;
    this.profissaoParaExcluir = null;
  }
}