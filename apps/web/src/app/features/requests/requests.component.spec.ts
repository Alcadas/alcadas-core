import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { RequestsComponent } from './requests.component';
import { RequestsService } from './services/requests.service';

describe('RequestsComponent', () => {
  let component: RequestsComponent;
  let fixture: ComponentFixture<RequestsComponent>;
  let router: Router;

  beforeEach(async () => {
    jest.useFakeTimers();
    await TestBed.configureTestingModule({
      imports: [RequestsComponent],
      providers: [
        RequestsService,
        {
          provide: Router,
          useValue: {
            navigate: jest.fn(),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParams: {},
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RequestsComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
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

  it('should navigate to create page on goToCreatePage', () => {
    component.goToCreatePage();
    expect(router.navigate).toHaveBeenCalledWith(['/solicitacoes/nova']);
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

  it('should toggle selection of items', () => {
    const firstItem = component.paginatedRequests()[0];
    component.toggleSelect(firstItem.id);
    expect(component.selectedIds().has(firstItem.id)).toBe(true);

    component.toggleSelect(firstItem.id);
    expect(component.selectedIds().has(firstItem.id)).toBe(false);
  });
});
