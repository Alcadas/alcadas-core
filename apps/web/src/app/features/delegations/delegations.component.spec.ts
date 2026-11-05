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

  it('deve gerar iniciais do nome corretamente', () => {
    expect(component.iniciais('Ana Souza')).toBe('AS');
    expect(component.iniciais('Carlos Lima')).toBe('CL');
    expect(component.iniciais('Carlos')).toBe('C');
  });
});
