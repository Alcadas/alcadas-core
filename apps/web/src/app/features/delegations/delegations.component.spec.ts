import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DelegationsComponent } from './delegations.component';

describe('DelegationsComponent', () => {
  let component: DelegationsComponent;
  let fixture: ComponentFixture<DelegationsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DelegationsComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(DelegationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('deve criar o componente de delegações', () => {
    expect(component).toBeTruthy();
  });

  it('deve inicializar com profissoes e perfis mockados', () => {
    expect(component.profissoes.length).toBeGreaterThan(0);
    expect(component.perfis.length).toBeGreaterThan(0);
  });

  it('deve paginar os perfis corretamente', () => {
    const totalPaginas = component.totalPaginas;
    expect(totalPaginas).toBeGreaterThanOrEqual(1);

    if (totalPaginas > 1) {
      component.mudarPagina(2);
      expect(component.pagina).toBe(2);
    }
  });

  it('deve abrir modal de nova profissao e fechar', () => {
    component.abrirNovaProfissao();
    expect(component.modalProfissaoAberto).toBe(true);
    expect(component.editandoProfissaoId).toBeNull();

    component.fecharModais();
    expect(component.modalProfissaoAberto).toBe(false);
  });

  it('deve abrir modal de novo perfil e fechar', () => {
    component.abrirNovoPerfil();
    expect(component.modalPerfilAberto).toBe(true);
    expect(component.editandoPerfilId).toBeNull();

    component.fecharModais();
    expect(component.modalPerfilAberto).toBe(false);
  });

  it('deve visualizar perfil e permissões', () => {
    const perfil = component.perfis[0];
    component.abrirVisualizacao(perfil);
    expect(component.perfilVisualizado).toBe(perfil);

    const permissoes = component.funcionalidadesDaProfissao(perfil.profissaoId);
    expect(Array.isArray(permissoes)).toBe(true);
  });

  it('deve alternar permissão de uma profissão', () => {
    const prof = component.profissoes[0];
    const initialChecked = component.temFuncionalidade(prof, 'trilha');
    component.alternarFuncionalidade(prof, 'trilha');
    const updatedProf = component.profissoes.find((p) => p.id === prof.id);
    expect(updatedProf).toBeDefined();
    if (updatedProf) {
      expect(component.temFuncionalidade(updatedProf, 'trilha')).toBe(!initialChecked);
    }
  });

  describe('#114: sem acesso à conta de terceiros', () => {
    const elemento = () => fixture.nativeElement as HTMLElement;

    it('não mostra o botão de entrar como outro funcionário', () => {
      expect(elemento().querySelector('[title*="Entrar como"]')).toBeNull();
      const icones = Array.from(elemento().querySelectorAll('.material-symbols-rounded')).map((i) => i.textContent?.trim());
      expect(icones).not.toContain('login');
    });

    it('não mostra a coluna nem o valor da senha dos funcionários', () => {
      const cabecalhos = Array.from(elemento().querySelectorAll('th')).map((th) => th.textContent?.trim());
      expect(cabecalhos).not.toContain('Senha');

      // Nenhuma célula da tabela pode conter exatamente a senha de um funcionário.
      const senhas = component.perfis.map((p) => p.senha).filter((s): s is string => !!s);
      expect(senhas.length).toBeGreaterThan(0);
      const celulas = Array.from(elemento().querySelectorAll('td')).map((td) => td.textContent?.trim());
      for (const senha of senhas) {
        expect(celulas).not.toContain(senha);
      }
    });

    it('mantém as ações de ver permissões, editar e excluir', () => {
      const titulos = Array.from(elemento().querySelectorAll('.col-acoes [title]')).map((b) => b.getAttribute('title'));
      expect(titulos).toEqual(expect.arrayContaining(['Ver permissões', 'Gerenciar funcionário na Organização', 'Excluir']));
    });
  });

  it('deve gerar iniciais do nome corretamente', () => {
    expect(component.iniciais('Ana Souza')).toBe('AS');
    expect(component.iniciais('Carlos Lima')).toBe('CL');
    expect(component.iniciais('Carlos')).toBe('C');
  });

  it('deve permitir cadastrar novo perfil escolhendo o departamento de RH', () => {
    component.abrirNovoPerfil();
    component.nome = 'Juliana RH';
    component.email = 'juliana.rh@startop.com.br';
    component.cargoPerfil = 'Analista de RH';
    component.profissaoId = component.profissoes[0].id;

    const deptRh = component.departamentos.find((d) => d.id === 'dep-rh') || component.departamentos[0];
    component.departamentoId = deptRh.id;

    component.salvarPerfil();

    expect(component.erro).toBe('');
    const criado = component.perfis.find((p) => p.email === 'juliana.rh@startop.com.br');
    expect(criado).toBeDefined();
    expect(criado?.departamento).toBe(deptRh.name);
    expect(criado?.departamentoId).toBe(deptRh.id);
  });

  it('deve recusar salvar perfil sem departamento selecionado', () => {
    component.abrirNovoPerfil();
    component.nome = 'Sem Depto';
    component.email = 'sem.depto@startop.com.br';
    component.profissaoId = component.profissoes[0].id;
    component.departamentoId = null;

    component.salvarPerfil();

    expect(component.erro).toBe('Selecione um departamento.');
  });

  it('deve permitir editar perfil e alterar seu departamento', () => {
    const perfil = component.perfis[0];
    component.abrirEdicaoPerfil(perfil);

    const novoDept = component.departamentos.find((d) => d.id !== perfil.departamentoId) ?? component.departamentos[0];
    component.departamentoId = novoDept.id;

    component.salvarPerfil();

    const atualizado = component.perfis.find((p) => p.id === perfil.id);
    expect(atualizado?.departamentoId).toBe(novoDept.id);
    expect(atualizado?.departamento).toBe(novoDept.name);
  });
});
