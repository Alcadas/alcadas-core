import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { MODELOS_REGRAS_ALCADA } from '@alcadas-core/models';
import { LimitsComponent } from './limits.component';
import { LimitsService } from './services/limits.service';

describe('LimitsComponent', () => {
  let component: LimitsComponent;
  let fixture: ComponentFixture<LimitsComponent>;
  let limitsService: LimitsService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LimitsComponent],
      providers: [
        LimitsService,
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => (key === 'id' ? 'ALC-TEST' : null),
              },
              queryParamMap: {
                get: () => null,
              },
            },
          },
        },
      ],
    }).compileComponents();

    limitsService = TestBed.inject(LimitsService);
    // Cria alçada prévia para teste de carregamento
    limitsService.createRule({
      id: 'ALC-TEST',
      title: 'Fluxo Existente Teste',
      department: 'Compras & Suprimentos',
      locationOrCenter: 'Filial Curitiba',
      status: 'ACTIVE',
      ceilingAmount: 50000,
    });

    fixture = TestBed.createComponent(LimitsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('deve ser instanciado corretamente', () => {
    expect(component).toBeTruthy();
  });

  it('deve carregar dados da regra existente pelo ID da rota', () => {
    expect(component.currentRuleId()).toBe('ALC-TEST');
    expect(component.currentRuleTitle()).toBe('Fluxo Existente Teste');
    expect(component.flowDepartment()).toBe('Compras & Suprimentos');
  });

  it('deve disponibilizar pelo menos 4 modelos de mercado na biblioteca', () => {
    expect(component.marketModels.length).toBeGreaterThanOrEqual(4);
    expect(component.filteredMarketModels().length).toBeGreaterThanOrEqual(4);
  });

  it('deve aplicar modelo pré-definido de mercado à esteira de nós', () => {
    const modelo = MODELOS_REGRAS_ALCADA[0];
    component.applyMarketModel(modelo);

    expect(component.currentRuleTitle()).toBe(modelo.nome);
    expect(component.workflowNodes().length).toBeGreaterThan(0);
    // Primeira faixa deve gerar nós de condição e aprovação correspondentes
    const condNode = component.workflowNodes().find((n) => n.type === 'CONDITION_VALUE');
    expect(condNode).toBeTruthy();
    const appNode = component.workflowNodes().find((n) => n.type === 'APPROVER');
    expect(appNode).toBeTruthy();
  });

  it('deve salvar o workflow na API/Firestore via LimitsService', () => {
    const saveSpy = jest.spyOn(limitsService, 'saveWorkflow');
    component.currentRuleTitle.set('Workflow Editado');
    component.saveWorkflow();

    expect(saveSpy).toHaveBeenCalledWith(
      'ALC-TEST',
      expect.objectContaining({
        title: 'Workflow Editado',
        department: component.flowDepartment(),
        nodes: component.workflowNodes(),
      }),
    );
    expect(component.saveSuccessMessage()).toContain('sucesso');
  });

  it('deve atualizar parâmetros no nó selecionado', () => {
    const firstNode = component.workflowNodes()[0];
    component.selectNode(firstNode.id);
    expect(component.selectedNode()?.id).toBe(firstNode.id);

    component.updateNodeField('title', 'Novo Título da Etapa');
    expect(component.selectedNode()?.title).toBe('Novo Título da Etapa');
  });

  it('deve permitir adicionar nó a partir de modelo individual', () => {
    const totalAntes = component.workflowNodes().length;
    const tpl = component.ruleTemplates()[0];
    component.addNode(tpl);

    expect(component.workflowNodes().length).toBe(totalAntes + 1);
    expect(component.selectedNode()?.type).toBe(tpl.type);
  });

  it('deve remover nó do pipeline', () => {
    // Adiciona nó para depois remover
    const tpl = component.ruleTemplates()[0];
    component.addNode(tpl);
    const addedId = component.selectedNodeId()!;
    const total = component.workflowNodes().length;

    component.deleteNode(addedId);
    expect(component.workflowNodes().length).toBe(total - 1);
    expect(component.selectedNodeId()).toBeNull();
  });
});
