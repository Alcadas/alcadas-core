import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { SolicitacaoResponseDto } from '@alcadas-core/models';
import { AuthUser } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import { APP_CONFIG } from '../../core/config/app-config';
import { eloDaApi, solicitacaoDaApi, tetoDaApi } from '../../core/testing/api-fixtures';
import { CONFIG_DE_TESTE } from '../../core/testing/test-config';
import { RequestsComponent } from './requests.component';
import { RequestsService } from './services/requests.service';

const URL_LISTA = '/api/solicitacoes?page=1&limit=50';

describe('RequestsComponent', () => {
  let fixture: ComponentFixture<RequestsComponent>;
  let component: RequestsComponent;
  let http: HttpTestingController;
  let usuario: AuthUser;
  let router: Router;

  const solicitacoes: SolicitacaoResponseDto[] = [
    solicitacaoDaApi({ id: 'sol-001', solicitanteId: 'ana', valor: 3200 }),
    solicitacaoDaApi({ id: 'sol-002', solicitanteId: 'carlos', status: 'APROVADA', versao: 2, valor: 900 }),
    solicitacaoDaApi({ id: 'sol-003', solicitanteId: 'ana', status: 'EM_AJUSTE', categoria: 'EQUIPAMENTOS', justificativa: 'Notebook novo' }),
  ];

  function texto(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function iniciar(): void {
    fixture = TestBed.createComponent(RequestsComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  }

  function responderCarga(lista = solicitacoes): void {
    http.expectOne(URL_LISTA).flush(lista);
    http
      .expectOne('/api/centros-custo')
      .flush([{ id: 'cc-clinica-centro', tenantId: 'startop', code: 'CC-CENTRO', name: 'Clínica Centro', isActive: true, createdAt: '', updatedAt: '' }]);
    http.expectOne('/api/alcadas/tetos').flush([tetoDaApi('N1', 1000), tetoDaApi('N2', 5000), tetoDaApi('N3', null)]);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    usuario = { id: 'carlos', email: 'gerente@startop.test', role: 'APROVADOR_N2', tenantId: 'startop' };
    await TestBed.configureTestingModule({
      imports: [RequestsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: CONFIG_DE_TESTE },
        { provide: AuthService, useValue: { currentUser: () => usuario } },
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
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('estados da tela (RNF08)', () => {
    it('mostra "Carregando…" enquanto a API responde', () => {
      iniciar();
      expect(texto()).toContain('Carregando…');
      responderCarga();
      expect(texto()).not.toContain('Carregando…');
    });

    it('mostra o erro com "Tentar novamente", que refaz a busca', () => {
      iniciar();
      http.expectOne('/api/centros-custo').flush([]);
      http.expectOne('/api/alcadas/tetos').flush([]);
      http.expectOne(URL_LISTA).flush({ message: 'Firestore indisponível.' }, { status: 500, statusText: 'Erro' });
      fixture.detectChanges();

      expect(texto()).toContain('Não foi possível carregar as solicitações');
      expect(texto()).toContain('Firestore indisponível.');

      component.reload();
      responderCarga();
      expect(component.filteredRequests()).toHaveLength(3);
    });

    it('mostra o estado vazio quando o tenant não tem solicitações', () => {
      iniciar();
      responderCarga([]);
      expect(texto()).toContain('Nenhuma solicitação ainda');
    });
  });

  describe('lista', () => {
    beforeEach(() => {
      iniciar();
      responderCarga();
    });

    it('should navigate to create page on goToCreatePage', () => {
      component.goToCreatePage();
      expect(router.navigate).toHaveBeenCalledWith(['/solicitacoes/nova']);
    });

    it('calcula os indicadores a partir dos dados da API', () => {
      expect(component.stats()).toMatchObject({ total: 3, pendentes: 1, aprovadas: 1, ajustes: 1 });
    });

    it('filtra pelas abas usando o status da API', () => {
      component.setTab('ajustes');
      expect(component.filteredRequests().map((r) => r.id)).toEqual(['sol-003']);
      component.setTab('aprovadas');
      expect(component.filteredRequests().map((r) => r.id)).toEqual(['sol-002']);
    });

    it('busca pelo texto da justificativa', () => {
      component.setSearchQuery('notebook');
      expect(component.filteredRequests().map((r) => r.id)).toEqual(['sol-003']);
    });

    it('ordena por maior valor', () => {
      component.setSortBy('maior_valor');
      expect(component.filteredRequests()[0].valor).toBe(3200);
    });

    it('marca e desmarca itens', () => {
      component.toggleSelect('sol-001');
      expect(component.selectedIds().has('sol-001')).toBe(true);
      component.toggleSelect('sol-001');
      expect(component.selectedIds().has('sol-001')).toBe(false);
    });
  });

  describe('nova solicitação (US-02)', () => {
    beforeEach(() => {
      iniciar();
      responderCarga();
      component.openCreateDrawer();
    });

    it('já vem com o primeiro centro de custo carregado da API', () => {
      expect(component.formCentroCustoId()).toBe('cc-clinica-centro');
    });

    it('CA-02.3: recusa valor zero ou com mais de 2 casas decimais', () => {
      component.formJustificativa.set('Troca de cabos');
      component.formValor.set(0);
      component.submitNewRequest();
      expect(component.formErrors()['valor']).toBeDefined();

      component.formValor.set(10.123);
      component.submitNewRequest();
      expect(component.formErrors()['valor']).toBeDefined();
    });

    it('CA-02.2: acima da base da categoria exige 30 caracteres de justificativa', () => {
      component.formCategoria.set('SERVICOS_TERCEIROS');
      component.formValor.set(1000.01);
      component.formJustificativa.set('x'.repeat(29));
      component.submitNewRequest();
      expect(component.formErrors()['justificativa']).toContain('30 caracteres');

      component.formValor.set(1000);
      component.submitNewRequest();
      expect(component.formErrors()['justificativa']).toBeUndefined();
      http.expectOne('/api/solicitacoes').flush(solicitacaoDaApi({ id: 'sol-010', valor: 1000 }));
      http.expectOne('/api/solicitacoes/sol-010/trilha').flush([]);
    });

    it('envia para a API, fecha o formulário e abre o detalhe com a trilha', () => {
      component.formValor.set(3200);
      component.formJustificativa.set('Manutenção do aparelho de raio-x da unidade Centro');
      component.submitNewRequest();

      const req = http.expectOne('/api/solicitacoes');
      expect(req.request.body).toEqual({
        centroCustoId: 'cc-clinica-centro',
        categoria: 'SERVICOS_TERCEIROS',
        valor: 3200,
        justificativa: 'Manutenção do aparelho de raio-x da unidade Centro',
      });
      req.flush(solicitacaoDaApi({ id: 'sol-010' }));
      http.expectOne('/api/solicitacoes/sol-010/trilha').flush([eloDaApi({ sequencia: 1 })]);

      expect(component.isCreateDrawerOpen()).toBe(false);
      expect(component.selectedRequest()?.id).toBe('sol-010');
      expect(component.trailSteps().map((e) => e.nome)).toEqual(['Solicitação criada']);
      expect(component.stats().total).toBe(4);
    });

    it('mostra o erro da API sem fechar o formulário', () => {
      component.formValor.set(50);
      component.formJustificativa.set('Papel A4');
      component.submitNewRequest();

      http.expectOne('/api/solicitacoes').flush({ message: 'Categoria não reconhecida.' }, { status: 400, statusText: 'Bad Request' });

      expect(component.isCreateDrawerOpen()).toBe(true);
      expect(component.formErrors()['geral']).toBe('Categoria não reconhecida.');
    });
  });

  describe('decisão do aprovador (US-03)', () => {
    beforeEach(() => {
      iniciar();
      responderCarga();
    });

    function abrir(id: string): void {
      const item = component.filteredRequests().find((r) => r.id === id);
      if (!item) throw new Error(`solicitação ${id} não carregada`);
      component.openDetailDrawer(item);
      http.expectOne(`/api/solicitacoes/${id}/trilha`).flush([eloDaApi({ sequencia: 1 })]);
      fixture.detectChanges();
    }

    it('CA-04.1: o autor não vê os botões de decisão do próprio pedido', () => {
      usuario = { ...usuario, id: 'ana' };
      abrir('sol-001');
      expect(component.canDecideSelected()).toBe(false);
    });

    it('US-09: solicitante não decide', () => {
      usuario = { ...usuario, role: 'SOLICITANTE' };
      abrir('sol-001');
      expect(component.canDecideSelected()).toBe(false);
    });

    it('CA-03.2: rejeitar sem motivo de 10 caracteres não chama a API', () => {
      abrir('sol-001');
      component.decisionMotivo.set('Sem verba');
      component.decide('rejeitar');
      expect(component.decisionError()).toContain('10 caracteres');
    });

    it('aprova com a versão lida, atualiza o detalhe e recarrega a trilha', () => {
      abrir('sol-001');
      expect(component.canDecideSelected()).toBe(true);

      component.decide('aprovar');
      const req = http.expectOne('/api/solicitacoes/sol-001/aprovar');
      expect(req.request.body).toEqual({ versao: 1 });
      req.flush(solicitacaoDaApi({ id: 'sol-001', status: 'APROVADA', versao: 2 }));
      http
        .expectOne('/api/solicitacoes/sol-001/trilha')
        .flush([eloDaApi({ sequencia: 1 }), eloDaApi({ sequencia: 2, tipoEvento: 'APROVACAO', authorId: 'carlos' })]);

      expect(component.selectedRequest()?.status).toBe('APROVADA');
      expect(component.trailSteps()).toHaveLength(2);
      expect(component.canDecideSelected()).toBe(false);
    });

    it('CA-05.1: mostra o conflito de versão devolvido pela API', () => {
      abrir('sol-001');
      component.decide('aprovar');
      http
        .expectOne('/api/solicitacoes/sol-001/aprovar')
        .flush({ message: 'Conflito de concorrência: outra decisão foi registrada.' }, { status: 409, statusText: 'Conflict' });

      expect(component.decisionError()).toContain('Conflito de concorrência');
      expect(component.selectedRequest()?.status).toBe('PENDENTE');
    });
  });

  describe('Polling Inteligente & Notificações em Tempo Real', () => {
    it('inicia o polling inteligente ao inicializar e encerra no ngOnDestroy', () => {
      const requestsService = TestBed.inject(RequestsService);
      const startSpy = jest.spyOn(requestsService, 'startPolling');
      const stopSpy = jest.spyOn(requestsService, 'stopPolling');

      iniciar();
      responderCarga();

      expect(startSpy).toHaveBeenCalledWith(8000);

      fixture.destroy();
      expect(stopSpy).toHaveBeenCalled();
    });

    it('exibe toast comemorativo quando uma solicitação do usuário é aprovada via polling', () => {
      iniciar();
      responderCarga([
        solicitacaoDaApi({ id: 'sol-carlos-1', codigo: '#SOL-101', solicitanteId: 'carlos', status: 'PENDENTE' }),
      ]);

      const requestsService = TestBed.inject(RequestsService);
      // Dispara loadSilent com status APROVADA
      requestsService.loadSilent().subscribe();
      http
        .expectOne('/api/solicitacoes?page=1&limit=50')
        .flush([
          solicitacaoDaApi({ id: 'sol-carlos-1', codigo: '#SOL-101', solicitanteId: 'carlos', status: 'APROVADA', versao: 2 }),
        ]);

      expect(component.toastMessage()).toContain('#SOL-CARLOS-1 foi aprovada! 🎉');
      expect(component.toastType()).toBe('success');
    });

    it('exibe toast de aviso quando uma solicitação do usuário é devolvida para ajuste via polling', () => {
      iniciar();
      responderCarga([
        solicitacaoDaApi({ id: 'sol-carlos-2', solicitanteId: 'carlos', status: 'PENDENTE' }),
      ]);

      const requestsService = TestBed.inject(RequestsService);
      requestsService.loadSilent().subscribe();
      http
        .expectOne('/api/solicitacoes?page=1&limit=50')
        .flush([
          solicitacaoDaApi({ id: 'sol-carlos-2', solicitanteId: 'carlos', status: 'EM_AJUSTE', versao: 2 }),
        ]);

      expect(component.toastMessage()).toContain('#SOL-CARLOS-2 foi devolvida para ajustes');
      expect(component.toastType()).toBe('info');
    });
  });
});
