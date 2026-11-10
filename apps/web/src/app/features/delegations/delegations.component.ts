import { Component, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import {
  SettingsService,
  mapearProfissaoParaRole,
  mapearRoleParaProfissaoId,
} from '../settings/services/settings.service';
import { OrganizationDepartment } from '../settings/models/organization.model';

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
  employeeId?: string;
  nome: string;
  email: string;
  profissaoId: number;
  departamento?: string;
  departamentoId?: string;
  cargo?: string;
  senha?: string;
  alcada?: number;
}

// Funcionalidades = telas do menu lateral do sistema controladas por delegação.
const FUNCIONALIDADES: Funcionalidade[] = [
  { chave: 'dashboard', label: 'Dashboard' },
  { chave: 'minhas_aprovacoes', label: 'Minhas Aprovações' },
  { chave: 'solicitacoes', label: 'Solicitações' },
  { chave: 'meus_fluxos', label: 'Meus Fluxos' },
  { chave: 'minhas_regras', label: 'Minhas Regras' },
  { chave: 'trilha', label: 'Trilha Criptográfica' },
  { chave: 'motor_riscos', label: 'Motor de Riscos' },
  { chave: 'delegacoes', label: 'Delegações & SoD' },
  { chave: 'organizacao', label: 'Organização & Empresa' },
];

const CLASSES_BADGE = ['cor-1', 'cor-2', 'cor-3', 'cor-4', 'cor-5'];
const ITENS_POR_PAGINA = 6;

@Component({
  selector: 'app-delegations',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="delegations-settings-wrapper">
      <!-- Cabeçalho de Identidade dentro de /configuracoes/delegacoes -->
      <header class="delegations-header">
        <div class="header-left">
          <div class="header-icon-box" aria-hidden="true">
            <span class="material-symbols-rounded">admin_panel_settings</span>
          </div>
          <div class="header-titles">
            <h1>Delegações & Controle de Acesso · {{ nomeEmpresaAtiva }}</h1>
            <p>
              Controle quais telas e ferramentas cada profissão e funcionário da empresa (<code>tenant: {{ tenantAtivoId }}</code>) pode acessar.
            </p>
          </div>
        </div>

        <div class="header-actions-group">
          <a routerLink="/configuracoes/organizacao" class="btn-primario" style="text-decoration: none">
            <span class="material-symbols-rounded" style="font-size: 18px">domain</span>
            <span>Gerenciar Funcionários no Quadro</span>
          </a>
        </div>
      </header>

      <div class="page-content">
      @if (mensagemSucesso) {
        <div class="banner-sucesso" role="status">
          <span class="material-symbols-rounded">check_circle</span>
          <span>{{ mensagemSucesso }}</span>
        </div>
      }

      <!-- ================= TABELA 1: PROFISSÕES E PERMISSÕES DA EMPRESA ================= -->
      <div class="card">
        <div class="card-titulo">
          <div>
            <h3>Funções / Profissões e Permissões de Acesso ({{ nomeEmpresaAtiva }})</h3>
            <p>
              Marque as telas e ferramentas do sistema que cada função da sua empresa está autorizada a acessar. As alterações refletem imediatamente no menu lateral e nas rotas dos funcionários.
            </p>
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
                  <th>Profissão / Papel</th>
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
                          disabled
                          title="Para alterar permissões, clique no botão de editar da profissão"
                        />
                      </td>
                    }
                    <td class="col-acoes">
                      <button type="button" class="btn-icone" title="Editar função" (click)="abrirEdicaoProfissao(prof)">
                        <span class="material-symbols-rounded">edit</span>
                      </button>
                      <button type="button" class="btn-icone perigo" title="Excluir função" (click)="pedirExclusaoProfissao(prof)">
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

      <!-- ================= TABELA 2: FUNCIONÁRIOS DA EMPRESA E ACESSOS ================= -->
      <div class="card">
        <div class="card-titulo">
          <div>
            <h3>Funcionários da Empresa e Controle de Acesso</h3>
            <p>
              Vincule cada funcionário de <strong>{{ nomeEmpresaAtiva }}</strong> a uma função/profissão para definir as ferramentas liberadas e credenciais de login.
            </p>
          </div>
          <span class="contador">{{ perfis.length }} funcionários</span>
        </div>

        @if (perfis.length === 0) {
          <div class="vazio">Nenhum funcionário cadastrado nesta empresa ainda.</div>
        } @else {
          <div class="tabela-scroll">
            <table class="tabela">
              <thead>
                <tr>
                  <th>Funcionário</th>
                  <th>E-mail de Login</th>
                  <th>Departamento</th>
                  <th>Senha</th>
                  <th>Profissão / Nível de Acesso</th>
                  <th class="col-acoes">Ações</th>
                </tr>
              </thead>
              <tbody>
                @for (perfil of perfisDaPagina; track perfil.id) {
                  <tr>
                    <td>
                      <div class="pessoa">
                        <span class="avatar">{{ iniciais(perfil.nome) }}</span>
                        <div>
                          <div class="nome">{{ perfil.nome }}</div>
                          @if (perfil.cargo) {
                            <div class="sub-cargo">{{ perfil.cargo }}</div>
                          }
                        </div>
                      </div>
                    </td>
                    <td><code>{{ perfil.email }}</code></td>
                    <td>{{ perfil.departamento || 'Geral' }}</td>
                    <td><code>{{ perfil.senha || '123456' }}</code></td>
                    <td>
                      <select
                        class="select-profissao-inline"
                        [ngModel]="perfil.profissaoId"
                        (ngModelChange)="trocarProfissaoDireto(perfil, $event)"
                        aria-label="Alterar profissão do funcionário"
                      >
                        @for (prof of profissoes; track prof.id) {
                          <option [ngValue]="prof.id">{{ prof.nome }}</option>
                        }
                      </select>
                    </td>
                    <td class="col-acoes">
                      @if (authService) {
                        <button
                          type="button"
                          class="btn-icone"
                          title="Testar acesso / Entrar como este funcionário"
                          (click)="simularAcessoPerfil(perfil)"
                        >
                          <span class="material-symbols-rounded">login</span>
                        </button>
                      }
                      <button type="button" class="btn-icone" title="Ver permissões" (click)="abrirVisualizacao(perfil)">
                        <span class="material-symbols-rounded">visibility</span>
                      </button>
                      <a
                        routerLink="/configuracoes/organizacao"
                        class="btn-icone"
                        title="Gerenciar funcionário na Organização"
                        style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center;"
                      >
                        <span class="material-symbols-rounded">edit</span>
                      </a>
                      <button type="button" class="btn-icone perigo" title="Excluir" (click)="pedirExclusaoPerfil(perfil)">
                        <span class="material-symbols-rounded">delete</span>
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

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
    </div>

    <!-- ================= MODAL: PROFISSÃO (criar / renomear) ================= -->
    @if (modalProfissaoAberto) {
      <div class="modal-fundo" role="presentation" tabindex="-1" (click)="fecharModais()" (keydown.escape)="fecharModais()">
        <div class="modal" role="dialog" aria-modal="true" tabindex="-1" (click)="$event.stopPropagation()" (keydown.escape)="fecharModais()">
          <h2>{{ editandoProfissaoId === null ? 'Nova Profissão' : 'Editar Profissão' }}</h2>

          <label class="campo">
            Nome da profissão
            <input type="text" [(ngModel)]="nomeProfissao" placeholder="Ex: Coordenador Financeiro" />
          </label>

          <div class="campo">
            Ferramentas que esta profissão pode acessar
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



    <!-- ================= MODAL: VER PERMISSÕES DA PESSOA ================= -->
    @if (perfilVisualizado !== null) {
      <div class="modal-fundo" role="presentation" tabindex="-1" (click)="fecharModais()" (keydown.escape)="fecharModais()">
        <div class="modal" role="dialog" aria-modal="true" tabindex="-1" (click)="$event.stopPropagation()" (keydown.escape)="fecharModais()">
          <h2>{{ perfilVisualizado.nome }}</h2>
          <p class="sub">{{ perfilVisualizado.email }} · Empresa: {{ nomeEmpresaAtiva }}</p>

          <div class="campo">
            Profissão atribuída
            <span [class]="'badge ' + classeDaProfissao(perfilVisualizado.profissaoId)">{{ nomeDaProfissao(perfilVisualizado.profissaoId) }}</span>
          </div>

          <div class="campo">
            Ferramentas liberadas no menu e rotas
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
      <div class="modal-fundo" role="presentation" tabindex="-1" (click)="fecharModais()" (keydown.escape)="fecharModais()">
        <div class="modal modal-confirma" role="dialog" aria-modal="true" tabindex="-1" (click)="$event.stopPropagation()" (keydown.escape)="fecharModais()">
          <span class="material-symbols-rounded icone-lixeira">delete</span>
          <h2>Tem certeza que deseja remover este funcionário?</h2>
          <p class="sub">{{ perfilParaExcluir.nome }}. Essa ação revogará o acesso imediatamente.</p>
          <div class="modal-botoes centro">
            <button type="button" class="btn-secundario" (click)="fecharModais()">Cancelar</button>
            <button type="button" class="btn-perigo" (click)="confirmarExclusaoPerfil()">Deletar</button>
          </div>
        </div>
      </div>
    }

    <!-- ================= MODAL: EXCLUIR PROFISSÃO ================= -->
    @if (profissaoParaExcluir !== null) {
      <div class="modal-fundo" role="presentation" tabindex="-1" (click)="fecharModais()" (keydown.escape)="fecharModais()">
        <div class="modal modal-confirma" role="dialog" aria-modal="true" tabindex="-1" (click)="$event.stopPropagation()" (keydown.escape)="fecharModais()">
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
    :host { display: block; width: 100%; min-width: 0; }
    .delegations-settings-wrapper {
      padding: 2rem 2.5rem 3rem;
      max-width: 1120px;
    }
    .delegations-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1.25rem;
      padding-bottom: 1.5rem;
      margin-bottom: 1.5rem;
      border-bottom: 1px solid #eef2f6;
      flex-wrap: wrap;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .header-icon-box {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: linear-gradient(135deg, #644ef3 0%, #4338ca 100%);
      color: #ffffff;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .header-titles h1 {
      margin: 0;
      font-size: 1.35rem;
      font-weight: 700;
      color: #0f172a;
    }
    .header-titles p {
      margin: 0.25rem 0 0;
      font-size: 0.85rem;
      color: #64748b;
    }
    .header-titles code {
      background: #f1f5f9;
      padding: 0.1rem 0.4rem;
      border-radius: 5px;
      font-size: 0.78rem;
      color: #334155;
    }
    .header-actions-group {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      flex-wrap: wrap;
    }
    .page-content {
      width: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .banner-sucesso {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      color: #065f46;
      padding: 0.7rem 1rem;
      border-radius: 10px;
      font-size: 0.84rem;
      font-weight: 600;
    }

    .card {
      background: #ffffff;
      border: 1px solid #eef2f6;
      border-radius: 14px;
      padding: 1.5rem 1.75rem;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      margin: 0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
    }
    .card-titulo {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.25rem;
      gap: 1rem;
      flex-wrap: wrap;
    }
    h3 { margin: 0 0 0.25rem; color: #0f172a; font-size: 1.05rem; font-weight: 700; }
    p { margin: 0; color: #64748b; font-size: 0.85rem; }
    .contador {
      font-size: 0.75rem;
      font-weight: 600;
      color: #644ef3;
      background: #f1eeff;
      padding: 0.2rem 0.65rem;
      border-radius: 999px;
    }
    .vazio { text-align: center; color: #64748b; font-size: 0.85rem; padding: 2rem 0; }

    .tabela-scroll { overflow-x: auto; width: 100%; }
    .tabela { width: 100%; border-collapse: collapse; font-size: 0.85rem; color: #0f172a; }
    .tabela th {
      text-align: left;
      padding: 0.75rem 0.75rem;
      color: #64748b;
      font-weight: 600;
      font-size: 0.8125rem;
      border-bottom: 1px solid #eef2f6;
    }
    .tabela td { padding: 0.85rem 0.75rem; border-bottom: 1px solid #eef2f6; vertical-align: middle; }
    .tabela td code {
      background: #f1f5f9;
      padding: 0.15rem 0.45rem;
      border-radius: 6px;
      font-size: 0.78rem;
      color: #334155;
    }
    .tabela-checks th.col-check { font-size: 0.75rem; text-align: center; min-width: 85px; }
    .col-check { text-align: center; }
    .col-check input { width: 17px; height: 17px; accent-color: #644ef3; }
    .col-check input:disabled { cursor: not-allowed; opacity: 0.75; }
    .tabela th.col-acoes, .tabela td.col-acoes { text-align: right; white-space: nowrap; width: 140px; }

    .pessoa { display: flex; align-items: center; gap: 0.65rem; }
    .nome { font-weight: 600; }
    .sub-cargo { font-size: 0.75rem; color: #64748b; }
    .avatar {
      width: 34px; height: 34px; border-radius: 50%; background: #f1eeff; color: #644ef3;
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 0.75rem; font-weight: 700; flex-shrink: 0;
    }

    .select-profissao-inline {
      border: 1px solid #dbe2ea;
      border-radius: 8px;
      padding: 0.35rem 0.6rem;
      font-size: 0.8rem;
      font-weight: 600;
      color: #334155;
      background: #f8fafc;
      cursor: pointer;
    }
    .select-profissao-inline:focus {
      outline: none;
      border-color: #644ef3;
      background: #ffffff;
    }

    .badge {
      display: inline-block; font-size: 0.75rem; font-weight: 600;
      padding: 3px 10px; border-radius: 999px;
    }
    .cor-1 { background: #f1eeff; color: #644ef3; }
    .cor-2 { background: #e0f2fe; color: #0369a1; }
    .cor-3 { background: #dcfce7; color: #15803d; }
    .cor-4 { background: #fef3c7; color: #b45309; }
    .cor-5 { background: #fce7f3; color: #be185d; }

    .btn-icone {
      background: none; border: none; cursor: pointer; color: #64748b; padding: 4px;
      border-radius: 6px; vertical-align: middle;
    }
    .btn-icone:hover { background: #f1eeff; color: #644ef3; }
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
      background: #644ef3; color: #ffffff; font-size: 0.8rem; font-weight: 600;
      min-width: 28px; text-align: center; padding: 4px 0; border-radius: 8px;
    }

    .btn-primario {
      background: #644ef3; color: #ffffff; border: none; border-radius: 8px;
      padding: 0.45rem 1rem; font-size: 0.8125rem; font-weight: 600; cursor: pointer;
      display: inline-flex; align-items: center; gap: 0.4rem; transition: all 0.15s ease;
    }
    .btn-primario:hover { background: #5640dd; }
    .btn-secundario {
      background: #ffffff; color: #0f172a; border: 1px solid #cbd5e1; border-radius: 8px;
      padding: 0.45rem 1rem; font-size: 0.8125rem; font-weight: 600; cursor: pointer;
      display: inline-flex; align-items: center; gap: 0.4rem; transition: all 0.15s ease;
    }
    .btn-perigo {
      background: #ef4444; color: #ffffff; border: none; border-radius: 8px;
      padding: 0.45rem 1rem; font-size: 0.8125rem; font-weight: 600; cursor: pointer;
      display: inline-flex; align-items: center; gap: 0.4rem; transition: all 0.15s ease;
    }
    .btn-perigo:hover { background: #dc2626; }

    .modal-fundo {
      position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45); z-index: 1000;
      display: flex; align-items: center; justify-content: center; padding: 1rem;
    }
    .modal {
      background: #ffffff; border-radius: 16px; padding: 1.75rem; width: 100%; max-width: 480px;
    }
    .modal h2 { margin: 0 0 0.25rem; font-size: 1.15rem; color: #0f172a; }
    .sub { margin-bottom: 1.1rem; }
    .modal-confirma { text-align: center; max-width: 400px; }
    .modal-confirma h2 { margin-top: 0.5rem; }
    .icone-lixeira { font-size: 40px; color: #ef4444; }

    .campo {
      display: flex; flex-direction: column; gap: 6px; margin-top: 0.9rem;
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

    .lista-checks { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; max-height: 220px; overflow-y: auto; }
    .check { display: flex; align-items: center; gap: 8px; font-weight: 400; font-size: 0.85rem; }
    .check input { width: 16px; height: 16px; accent-color: #644EF3; }

    .erro { color: #dc2626; font-size: 0.8rem; margin-top: 0.75rem; }
    .modal-botoes { display: flex; justify-content: flex-end; gap: 0.6rem; margin-top: 1.4rem; }
    .modal-botoes.centro { justify-content: center; }
  `]
})
export class DelegationsComponent {
  private readonly settingsService = inject(SettingsService);
  private readonly router = inject(Router);
  protected readonly authService = inject(AuthService, { optional: true });

  funcionalidades = FUNCIONALIDADES;
  profissoes: Profissao[] = [];
  perfis: Perfil[] = [];

  pagina = 1;
  mensagemSucesso = '';

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

  // formulário de perfil (funcionário)
  editandoPerfilId: number | null = null;
  nome = '';
  email = '';
  senhaPerfil = '123456';
  cargoPerfil = '';
  profissaoId: number | null = null;
  departamentoId: string | null = null;

  erro = '';

  constructor() {
    this.carregarDadosDoTenantAtivo();
    effect(() => {
      // Recarrega sempre que o tenant ou os colaboradores da organização mudarem
      this.settingsService.activeTenantId();
      this.settingsService.organization();
      this.settingsService.activeProfissoes();
      this.carregarDadosDoTenantAtivo();
    });
  }

  get departamentos(): OrganizationDepartment[] {
    return this.settingsService.organization().departments;
  }

  get nomeEmpresaAtiva(): string {
    return this.settingsService.organization().tradeName;
  }

  get tenantAtivoId(): string {
    return this.settingsService.activeTenantId();
  }

  private carregarDadosDoTenantAtivo(): void {
    const profs = this.settingsService.activeProfissoes();
    this.profissoes = profs.map((p) => ({
      id: p.id,
      nome: p.nome,
      funcionalidades: [...p.funcionalidades],
    }));

    const employees = this.settingsService.organization().employees;
    this.perfis = employees.map((emp, idx) => ({
      id: idx + 1,
      employeeId: emp.id,
      nome: emp.fullName,
      email: emp.email,
      profissaoId: emp.profissaoId ?? mapearRoleParaProfissaoId(emp.role, profs),
      departamento: emp.departmentName,
      departamentoId: emp.departmentId,
      cargo: emp.jobTitle,
      senha: emp.password || '123456',
      alcada: emp.approvalLimit,
    }));
  }

  private exibirFeedback(msg: string): void {
    this.mensagemSucesso = msg;
  }

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
    this.settingsService.updateActiveProfissoes(this.profissoes);
    this.exibirFeedback(`Permissões da profissão "${prof.nome}" atualizadas para a empresa.`);
  }

  abrirNovaProfissao(): void {
    this.editandoProfissaoId = null;
    this.nomeProfissao = '';
    this.checksDoForm = ['solicitacoes'];
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
      (p) => p.nome.toLowerCase() === nomeLimpo.toLowerCase() && p.id !== this.editandoProfissaoId,
    );
    if (repetida) {
      this.erro = 'Já existe uma profissão com esse nome.';
      return;
    }

    if (this.editandoProfissaoId === null) {
      const novoId =
        this.profissoes.length > 0 ? Math.max(...this.profissoes.map((p) => p.id)) + 1 : 1;
      this.profissoes = [
        ...this.profissoes,
        { id: novoId, nome: nomeLimpo, funcionalidades: this.checksDoForm },
      ];
    } else {
      this.profissoes = this.profissoes.map((p) =>
        p.id === this.editandoProfissaoId
          ? { ...p, nome: nomeLimpo, funcionalidades: this.checksDoForm }
          : p,
      );
    }
    this.settingsService.updateActiveProfissoes(this.profissoes);
    this.exibirFeedback(`Profissão "${nomeLimpo}" salva com sucesso.`);
    this.fecharModais();
  }

  pedirExclusaoProfissao(prof: Profissao): void {
    this.profissaoParaExcluir = prof;
  }

  confirmarExclusaoProfissao(): void {
    if (this.profissaoParaExcluir !== null) {
      const idExcluido = this.profissaoParaExcluir.id;
      this.profissoes = this.profissoes.filter((p) => p.id !== idExcluido);
      this.settingsService.updateActiveProfissoes(this.profissoes);
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

  trocarProfissaoDireto(perfil: Perfil, novaProfissaoId: number): void {
    const idNum = Number(novaProfissaoId);
    perfil.profissaoId = idNum;
    const nomeProf = this.nomeDaProfissao(idNum);
    const novoRole = mapearProfissaoParaRole(nomeProf);

    if (perfil.employeeId) {
      this.settingsService.updateEmployee(perfil.employeeId, {
        profissaoId: idNum,
        role: novoRole,
      });
      this.exibirFeedback(
        `Acesso de ${perfil.nome} alterado para "${nomeProf}" na empresa ${this.nomeEmpresaAtiva}.`,
      );
    }
  }

  simularAcessoPerfil(perfil: Perfil): void {
    if (!this.authService) return;
    const usuario = this.authService.loginWithTenantAccount(perfil.email);
    if (usuario) {
      const rota = this.settingsService.getFirstAllowedRouteForCurrentUser();
      void this.router.navigate([rota]);
    }
  }

  abrirNovoPerfil(): void {
    this.editandoPerfilId = null;
    this.nome = '';
    this.email = '';
    this.senhaPerfil = '123456';
    this.cargoPerfil = '';
    this.profissaoId = null;
    this.departamentoId = this.departamentos[0]?.id ?? null;
    this.erro = '';
    this.modalPerfilAberto = true;
  }

  abrirEdicaoPerfil(perfil: Perfil): void {
    this.editandoPerfilId = perfil.id;
    this.nome = perfil.nome;
    this.email = perfil.email;
    this.senhaPerfil = perfil.senha || '123456';
    this.cargoPerfil = perfil.cargo || '';
    this.profissaoId = perfil.profissaoId;
    this.departamentoId = perfil.departamentoId ?? null;
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
    if (!this.departamentoId) {
      this.erro = 'Selecione um departamento.';
      return;
    }
    if (this.profissaoId === null) {
      this.erro = 'Selecione uma profissão.';
      return;
    }
    const emailRepetido = this.perfis.some(
      (p) => p.email.toLowerCase() === emailLimpo && p.id !== this.editandoPerfilId,
    );
    if (emailRepetido) {
      this.erro = 'Já existe um perfil com esse email.';
      return;
    }

    const idDaProfissao: number = this.profissaoId;
    const nomeProf = this.nomeDaProfissao(idDaProfissao);
    const roleMapeado = mapearProfissaoParaRole(nomeProf);
    const depts = this.settingsService.organization().departments;
    const deptEscolhido = depts.find((d) => d.id === this.departamentoId) || depts[0];

    if (this.editandoPerfilId === null) {
      const nextNum = 210 + this.perfis.length;
      this.settingsService.addEmployee({
        employeeCode: `COL-0${nextNum}`,
        fullName: nomeLimpo,
        email: emailLimpo,
        phone: '',
        jobTitle: this.cargoPerfil.trim() || nomeProf,
        role: roleMapeado,
        departmentId: deptEscolhido?.id ?? 'dep-geral',
        departmentName: deptEscolhido?.name ?? 'Geral',
        approvalLimit: roleMapeado === 'DIRETOR' ? 200000 : roleMapeado === 'GERENTE' ? 50000 : 0,
        status: 'ATIVO',
        password: this.senhaPerfil.trim() || '123456',
        profissaoId: idDaProfissao,
      });
      this.exibirFeedback(
        `Funcionário ${nomeLimpo} (${emailLimpo}) cadastrado com a função "${nomeProf}".`,
      );
    } else {
      const alvo = this.perfis.find((p) => p.id === this.editandoPerfilId);
      if (alvo?.employeeId) {
        this.settingsService.updateEmployee(alvo.employeeId, {
          fullName: nomeLimpo,
          email: emailLimpo,
          jobTitle: this.cargoPerfil.trim() || alvo.cargo || nomeProf,
          role: roleMapeado,
          profissaoId: idDaProfissao,
          password: this.senhaPerfil.trim() || '123456',
          departmentId: deptEscolhido?.id ?? alvo.departamentoId ?? 'dep-geral',
          departmentName: deptEscolhido?.name ?? alvo.departamento ?? 'Geral',
        });
        if (this.authService?.currentUser()?.email?.toLowerCase() === emailLimpo) {
          this.authService.loginWithTenantAccount(emailLimpo);
        }
      }
      this.exibirFeedback(`Dados e permissões de ${nomeLimpo} atualizados.`);
    }
    this.carregarDadosDoTenantAtivo();
    this.fecharModais();
  }

  confirmarExclusaoPerfil(): void {
    if (this.perfilParaExcluir !== null) {
      if (this.perfilParaExcluir.employeeId) {
        this.settingsService.removeEmployee(this.perfilParaExcluir.employeeId);
      }
      this.carregarDadosDoTenantAtivo();
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
    this.erro = '';
  }
}
