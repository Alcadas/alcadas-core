import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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
