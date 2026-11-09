import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { RulesCatalogComponent } from './rules-catalog.component';
import { LimitsService } from '../../services/limits.service';

describe('RulesCatalogComponent', () => {
  let component: RulesCatalogComponent;
  let fixture: ComponentFixture<RulesCatalogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RulesCatalogComponent],
      providers: [LimitsService, provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(RulesCatalogComponent);
    component = fixture.componentInstance;
    component.seedForTesting();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should compute initial rules and counts', () => {
    expect(component.rulesList().length).toBeGreaterThan(0);
    expect(component.activeRulesCount()).toBeGreaterThan(0);
    expect(component.totalRulesCount()).toBe(component.rulesList().length);
    expect(component.filteredRulesList().length).toBe(component.rulesList().length);
  });

  it('should filter rules by seeOnlyActive', () => {
    component.seeOnlyActive.set(true);
    component.filteredRulesList().forEach((r) => {
      expect(r.isActive).toBe(true);
    });
  });

  it('should filter rules by search query', () => {
    component.searchQuery.set('Capex');
    expect(component.filteredRulesList().length).toBeGreaterThan(0);
    component.filteredRulesList().forEach((r) => {
      expect(
        r.name.toLowerCase().includes('capex') || r.typeLabel.toLowerCase().includes('capex')
      ).toBe(true);
    });
  });

  it('should toggle rule active state', () => {
    const firstRule = component.rulesList()[0];
    const initialStatus = firstRule.isActive;

    component.toggleRuleActive(firstRule.id);
    const updated = component.rulesList().find((r) => r.id === firstRule.id);
    expect(updated?.isActive).toBe(!initialStatus);
  });

  it('should open, configure and close create modal', () => {
    expect(component.isCreateModalOpen()).toBe(false);

    component.openCreateModal();
    expect(component.isCreateModalOpen()).toBe(true);
    expect(component.modalRuleName()).toBe('');

    component.selectModalMethod('manual');
    expect(component.modalCreationMethod()).toBe('manual');

    component.selectModalScope('department');
    expect(component.modalScope()).toBe('department');

    component.closeCreateModal();
    expect(component.isCreateModalOpen()).toBe(false);
  });

  it('should validate empty rule name when creating', () => {
    component.openCreateModal();
    component.modalRuleName.set('');
    component.confirmCreateRule();

    expect(component.modalErrorMessage()).toBeTruthy();
    expect(component.isCreateModalOpen()).toBe(true);
  });

  it('should create rule and switch to editor tab', () => {
    component.openCreateModal();
    component.modalRuleName.set('Regra Teste Unitário');
    component.selectModalMethod('prompt');
    component.confirmCreateRule();

    expect(component.isCreateModalOpen()).toBe(false);
    expect(component.activeCatalogTab()).toBe('editor');
    expect(component.editingRule()?.name).toBe('Regra Teste Unitário');
    expect(component.editingMode()).toBe('prompt');
  });

  it('should handle AI chat prompt', (done) => {
    component.chatPrompt.set('Aprovação dupla acima de 50k');
    component.sendChatMessage();

    expect(component.isAiThinking()).toBe(true);
    setTimeout(() => {
      expect(component.isAiThinking()).toBe(false);
      expect(component.chatMessages().length).toBeGreaterThanOrEqual(2);
      done();
    }, 1000);
  });

  describe('wizard de modelos pré-definidos (#69)', () => {
    let limitsService: LimitsService;

    beforeEach(() => {
      limitsService = TestBed.inject(LimitsService);
      component.openCreateModal();
    });

    it('abre no passo de escolha entre modelo pronto e criar do zero', () => {
      expect(component.wizardStep()).toBe('choose');
      component.startFromScratch();
      expect(component.wizardStep()).toBe('scratch');
      component.wizardBack();
      component.startFromTemplate();
      expect(component.wizardStep()).toBe('template');
    });

    it('oferece pelo menos 4 modelos', () => {
      expect(component.modelos.length).toBeGreaterThanOrEqual(4);
    });

    it('ao selecionar um modelo pré-preenche nome, centro de custo, SLA e faixas', () => {
      const modelo = component.modelos[0];
      component.selectTemplate(modelo);

      expect(component.wizardStep()).toBe('configure');
      expect(component.wizardName()).toBe(modelo.nome);
      expect(component.wizardCostCenter()).toBe(modelo.centroCustoSugerido);
      expect(component.wizardSlaHours()).toBe(modelo.slaHoras);
      expect(component.wizardFaixas().map((f) => f.valorMaximo)).toEqual(
        modelo.faixas.map((f) => f.valorMaximo),
      );
      expect(component.canSaveWizard()).toBe(true);
    });

    it('permite personalizar valores e papéis sem alterar o modelo original', () => {
      const modelo = component.modelos[0];
      component.selectTemplate(modelo);
      component.updateFaixaValor(0, 'valorMaximo', 800);
      component.updateFaixa(0, { papelAprovador: 'GERENTE' });

      expect(component.wizardFaixas()[0]).toMatchObject({ valorMaximo: 800, papelAprovador: 'GERENTE' });
      expect(modelo.faixas[0].valorMaximo).toBe(500);
    });

    it('valida em tempo real mínimo < máximo e bloqueia o salvamento', () => {
      component.selectTemplate(component.modelos[0]);
      component.updateFaixaValor(0, 'valorMaximo', 0);

      expect(component.faixaErrors(0).length).toBeGreaterThan(0);
      expect(component.canSaveWizard()).toBe(false);
    });

    it('adiciona faixa contígua e permite remover', () => {
      component.selectTemplate(component.modelos[0]);
      const total = component.wizardFaixas().length;
      component.addFaixa();
      component.updateFaixa(total, { papelAprovador: 'CFO' });

      expect(component.wizardFaixas().length).toBe(total + 1);
      expect(component.wizardFaixaErrors()).toEqual([]);

      component.removeFaixa(total);
      expect(component.wizardFaixas().length).toBe(total);
    });

    it('salva a regra na API com as faixas e adiciona à lista', () => {
      const spy = jest
        .spyOn(limitsService, 'saveRuleCatalogEntry')
        .mockReturnValue(of({ savedWorkflows: 0, savedRules: 1 }));
      const modelo = component.modelos[1];
      component.selectTemplate(modelo);
      component.saveRuleFromTemplate();

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ name: modelo.nome, modeloId: modelo.id, type: modelo.categoria }),
      );
      expect(component.rulesList()[0].faixas?.length).toBe(modelo.faixas.length);
      expect(component.isCreateModalOpen()).toBe(false);
    });

    it('mantém o modal aberto e mostra o erro quando a API recusa', () => {
      jest
        .spyOn(limitsService, 'saveRuleCatalogEntry')
        .mockReturnValue(throwError(() => new Error('falhou')));
      const antes = component.rulesList().length;
      component.selectTemplate(component.modelos[0]);
      component.saveRuleFromTemplate();

      expect(component.wizardSaveError()).toBeTruthy();
      expect(component.isCreateModalOpen()).toBe(true);
      expect(component.rulesList().length).toBe(antes);
    });
  });

  it('should save editor changes and return to rules tab', () => {
    const rule = component.rulesList()[0];
    component.openEditorForRule(rule);
    expect(component.activeCatalogTab()).toBe('editor');

    component.manualAmount.set(99000);
    component.manualRole.set('DIRETOR');
    component.saveEditorChanges();

    expect(component.activeCatalogTab()).toBe('rules');
    expect(component.editingRule()).toBeNull();
  });
});
