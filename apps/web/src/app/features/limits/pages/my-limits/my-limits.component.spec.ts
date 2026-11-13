import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { MODELOS_REGRAS_ALCADA } from '@alcadas-core/models';
import { MyLimitsComponent } from './my-limits.component';
import { LimitsService } from '../../services/limits.service';

describe('MyLimitsComponent', () => {
  let component: MyLimitsComponent;
  let fixture: ComponentFixture<MyLimitsComponent>;
  let limitsService: LimitsService;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyLimitsComponent],
      providers: [
        LimitsService,
        provideRouter([
          { path: 'alcadas/editor/:id', component: MyLimitsComponent },
        ]),
      ],
    }).compileComponents();

    limitsService = TestBed.inject(LimitsService);
    router = TestBed.inject(Router);

    fixture = TestBed.createComponent(MyLimitsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('deve instanciar o componente', () => {
    expect(component).toBeTruthy();
  });

  it('deve abrir o modal no passo de escolha entre modelo pronto e do zero', () => {
    expect(component.isCreateModalOpen()).toBe(false);
    component.openCreateModal();
    expect(component.isCreateModalOpen()).toBe(true);
    expect(component.wizardStep()).toBe('choose');

    component.startFromTemplate();
    expect(component.wizardStep()).toBe('template');

    component.wizardBack();
    expect(component.wizardStep()).toBe('choose');

    component.startFromScratch();
    expect(component.wizardStep()).toBe('scratch');
  });

  it('deve listar pelo menos 4 modelos pré-definidos de alçada', () => {
    expect(component.modelos.length).toBeGreaterThanOrEqual(4);
  });

  it('ao selecionar um modelo, preenche automaticamente parâmetros e faixas', () => {
    component.openCreateModal();
    const modelo = MODELOS_REGRAS_ALCADA[0];
    component.selectTemplate(modelo);

    expect(component.wizardStep()).toBe('configure');
    expect(component.wizardName()).toBe(modelo.nome);
    expect(component.wizardCostCenter()).toBe(modelo.centroCustoSugerido);
    expect(component.wizardQuorum()).toBe(modelo.quorum);
    expect(component.wizardSlaHours()).toBe(modelo.slaHoras);
    expect(component.wizardFaixas().length).toBe(modelo.faixas.length);
    expect(component.canSaveWizard()).toBe(true);
  });

  it('deve permitir personalizar faixas e papéis a partir do template', () => {
    component.openCreateModal();
    const modelo = MODELOS_REGRAS_ALCADA[0];
    component.selectTemplate(modelo);

    component.updateFaixaValor(0, 'valorMaximo', 750);
    component.updateFaixa(0, { papelAprovador: 'GERENTE' });

    expect(component.wizardFaixas()[0].valorMaximo).toBe(750);
    expect(component.wizardFaixas()[0].papelAprovador).toBe('GERENTE');
  });

  it('deve validar em tempo real mínimo < máximo e bloquear a criação', () => {
    component.openCreateModal();
    const modelo = MODELOS_REGRAS_ALCADA[0];
    component.selectTemplate(modelo);

    component.updateFaixaValor(0, 'valorMaximo', 0);
    expect(component.faixaErrors(0).length).toBeGreaterThan(0);
    expect(component.canSaveWizard()).toBe(false);
  });

  it('deve criar o fluxo a partir do modelo, persistir e navegar para o editor', () => {
    const navSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    const createSpy = jest.spyOn(limitsService, 'createRuleFromModelo');

    component.openCreateModal();
    const modelo = MODELOS_REGRAS_ALCADA[1]; // Aquisição de Equipamentos de TI
    component.selectTemplate(modelo);
    component.confirmCreateFromTemplate();

    expect(createSpy).toHaveBeenCalledWith(
      modelo,
      expect.objectContaining({
        nome: modelo.nome,
        centroCusto: modelo.centroCustoSugerido,
      }),
    );
    expect(component.isCreateModalOpen()).toBe(false);
    expect(navSpy).toHaveBeenCalledWith(
      expect.arrayContaining(['/alcadas/editor']),
    );
  });

  it('deve permitir criar fluxo do zero e navegar para o editor', () => {
    const navSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    component.openCreateModal();
    component.startFromScratch();
    component.newRuleTitle.set('Fluxo Manual Teste');
    component.confirmCreateFromScratch();

    expect(component.isCreateModalOpen()).toBe(false);
    expect(navSpy).toHaveBeenCalledWith(
      expect.arrayContaining(['/alcadas/editor']),
    );
  });
});
