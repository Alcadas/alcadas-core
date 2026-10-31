import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RequestsComponent } from './requests.component';
import { RequestsService } from './services/requests.service';

describe('RequestsComponent', () => {
  let component: RequestsComponent;
  let fixture: ComponentFixture<RequestsComponent>;
  let service: RequestsService;

  beforeEach(async () => {
    jest.useFakeTimers();
    await TestBed.configureTestingModule({
      imports: [RequestsComponent],
      providers: [RequestsService],
    }).compileComponents();

    fixture = TestBed.createComponent(RequestsComponent);
    component = fixture.componentInstance;
    service = TestBed.inject(RequestsService);
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should create the requests component', () => {
    expect(component).toBeTruthy();
  });

  it('should load initial stats and requests', () => {
    expect(component.stats().total).toBeGreaterThan(0);
    expect(component.filteredRequests().length).toBeGreaterThan(0);
  });

  it('should filter requests by tab correctly', () => {
    component.setTab('pendentes');
    fixture.detectChanges();

    const pending = component.filteredRequests();
    expect(pending.every((r) => r.status === 'PENDENTE')).toBe(true);

    component.setTab('aprovadas');
    fixture.detectChanges();
    const approved = component.filteredRequests();
    expect(approved.every((r) => r.status === 'APROVADA')).toBe(true);
  });

  it('should filter requests by search query', () => {
    component.setSearchQuery('Figma');
    fixture.detectChanges();

    const filtered = component.filteredRequests();
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.some((r) => r.titulo.includes('Figma'))).toBe(true);
  });

  it('should open and close create drawer', () => {
    expect(component.isCreateDrawerOpen()).toBe(false);
    component.openCreateDrawer();
    expect(component.isCreateDrawerOpen()).toBe(true);
    component.closeCreateDrawer();
    expect(component.isCreateDrawerOpen()).toBe(false);
  });

  it('should open and close detail drawer', () => {
    const item = component.filteredRequests()[0];
    component.openDetailDrawer(item);
    expect(component.isDetailDrawerOpen()).toBe(true);
    expect(component.selectedRequest()?.id).toBe(item.id);

    component.closeDetailDrawer();
    expect(component.isDetailDrawerOpen()).toBe(false);
    expect(component.selectedRequest()).toBeNull();
  });

  it('should validate form and reject invalid submissions', () => {
    component.openCreateDrawer();
    component.formTitulo.set('');
    component.formValor.set(0);
    component.formJustificativa.set('Curta');

    component.submitNewRequest();
    expect(Object.keys(component.formErrors()).length).toBeGreaterThan(0);
    expect(component.isCreateDrawerOpen()).toBe(true);
  });

  it('should submit valid request and add it to list', () => {
    const initialTotal = service.requests().length;
    component.openCreateDrawer();
    component.formTitulo.set('Nova Cotação de Teste Automatizado');
    component.formValor.set(7500);
    component.formJustificativa.set('Justificativa válida com mais de trinta caracteres para teste de governança.');

    component.submitNewRequest();
    jest.advanceTimersByTime(700);
    fixture.detectChanges();

    expect(service.requests().length).toBe(initialTotal + 1);
    expect(component.isCreateDrawerOpen()).toBe(false);
  });

  it('should toggle selection of items', () => {
    const firstItem = component.paginatedRequests()[0];
    component.toggleSelect(firstItem.id);
    expect(component.selectedIds().has(firstItem.id)).toBe(true);

    component.toggleSelect(firstItem.id);
    expect(component.selectedIds().has(firstItem.id)).toBe(false);
  });
});
