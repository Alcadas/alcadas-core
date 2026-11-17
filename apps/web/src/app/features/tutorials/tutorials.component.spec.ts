import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TutorialsComponent } from './tutorials.component';

describe('TutorialsComponent', () => {
  let component: TutorialsComponent;
  let fixture: ComponentFixture<TutorialsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TutorialsComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(TutorialsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('deve criar o componente de tutoriais', () => {
    expect(component).toBeTruthy();
  });

  it('deve alternar entre as abas de tutoriais', () => {
    expect(component.activeTab()).toBe('solicitacoes');
    component.selectTab('aprovacoes');
    expect(component.activeTab()).toBe('aprovacoes');
    component.selectTab('alcadas');
    expect(component.activeTab()).toBe('alcadas');
    component.selectTab('organizacao');
    expect(component.activeTab()).toBe('organizacao');
  });

  it('deve simular esteira operacional para valores baixos', () => {
    component.simValue.set(5000);
    const path = component.simulatedPath();
    expect(path.levels).toContain('Gerente Aprovador');
    expect(path.levels).not.toContain('CFO / Comitê Financeiro');
  });

  it('deve simular esteira executiva para valores altos', () => {
    component.simValue.set(120000);
    const path = component.simulatedPath();
    expect(path.levels).toContain('CFO / Comitê Financeiro');
  });

  it('deve expandir e recolher item do FAQ', () => {
    expect(component.faqs()[0].isOpen).toBe(false);
    component.toggleFaq(0);
    expect(component.faqs()[0].isOpen).toBe(true);
    component.toggleFaq(0);
    expect(component.faqs()[0].isOpen).toBe(false);
  });

  it('deve filtrar faqs conforme termo de busca', () => {
    component.searchQuery.set('criptográfica');
    const filtered = component.filteredFaqs();
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered[0].question.toLowerCase()).toContain('criptográfica');
  });
});
