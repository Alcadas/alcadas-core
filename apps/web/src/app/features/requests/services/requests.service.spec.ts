import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../../core/auth/auth.service';
import { APP_CONFIG } from '../../../core/config/app-config';
import { eloDaApi, solicitacaoDaApi, tetoDaApi } from '../../../core/testing/api-fixtures';
import { CONFIG_DE_TESTE } from '../../../core/testing/test-config';
import { RequestItem, RequestStatusChangeEvent } from '../requests.models';
import { RequestsService } from './requests.service';

describe('RequestsService', () => {
  let service: RequestsService;
  let http: HttpTestingController;

  function responderCarga(solicitacoes = [solicitacaoDaApi()]): void {
    http.expectOne('/api/solicitacoes?page=1&limit=50').flush(solicitacoes);
    http.expectOne('/api/centros-custo').flush([
      { id: 'cc-clinica-centro', tenantId: 'startop', code: 'CC-CENTRO', name: 'Clínica Centro', isActive: true, createdAt: '', updatedAt: '' },
    ]);
    http.expectOne('/api/alcadas/tetos').flush([tetoDaApi('N2', 5000)]);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: CONFIG_DE_TESTE },
        { provide: AuthService, useValue: { currentUser: () => ({ id: 'carlos', email: '', role: 'APROVADOR_N2' }) } },
      ],
    });
    service = TestBed.inject(RequestsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('carrega solicitações, centros de custo e tetos da API', () => {
    service.load();
    expect(service.loadState()).toBe('carregando');

    responderCarga();

    expect(service.loadState()).toBe('pronto');
    expect(service.requests()).toHaveLength(1);
    expect(service.requests()[0].centroCustoNome).toBe('Clínica Centro');
    expect(service.costCenters()).toEqual([{ id: 'cc-clinica-centro', code: 'CC-CENTRO', nome: 'Clínica Centro' }]);
    expect(service.stats()).toMatchObject({ total: 1, pendentes: 1, pendentesValorTotal: 3200 });
  });

  it('mostra a lista mesmo se centros de custo e tetos falharem', () => {
    service.load();
    http.expectOne('/api/solicitacoes?page=1&limit=50').flush([solicitacaoDaApi()]);
    http.expectOne('/api/centros-custo').flush({}, { status: 403, statusText: 'Forbidden' });
    http.expectOne('/api/alcadas/tetos').flush({}, { status: 500, statusText: 'Erro' });

    expect(service.loadState()).toBe('pronto');
    expect(service.requests()[0].centroCustoNome).toBe('cc-clinica-centro');
  });

  it('RNF08: guarda a mensagem quando a lista falha', () => {
    service.load();
    http.expectOne('/api/centros-custo').flush([]);
    http.expectOne('/api/alcadas/tetos').flush([]);
    http.expectOne('/api/solicitacoes?page=1&limit=50').flush(
      { statusCode: 500, message: 'Firestore indisponível.' },
      { status: 500, statusText: 'Erro' },
    );

    expect(service.loadState()).toBe('erro');
    expect(service.loadError()).toBe('Firestore indisponível.');
  });

  it('T01: cria a solicitação e coloca no topo da lista', () => {
    service.load();
    responderCarga();

    let criada: RequestItem | undefined;
    service
      .create({ centroCustoId: 'cc-clinica-centro', categoria: 'EQUIPAMENTOS', valor: 900, justificativa: 'Monitor' })
      .subscribe((item) => (criada = item));

    const req = http.expectOne('/api/solicitacoes');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ centroCustoId: 'cc-clinica-centro', categoria: 'EQUIPAMENTOS', valor: 900, justificativa: 'Monitor' });
    req.flush(solicitacaoDaApi({ id: 'sol-002', categoria: 'EQUIPAMENTOS', valor: 900 }));

    expect(criada?.id).toBe('sol-002');
    expect(service.requests().map((r) => r.id)).toEqual(['sol-002', 'sol-001']);
  });

  it('CA-05.1: aprova enviando a versão lida e atualiza o item', () => {
    service.load();
    responderCarga();
    const [pendente] = service.requests();

    service.decide(pendente, 'aprovar').subscribe();

    const req = http.expectOne('/api/solicitacoes/sol-001/aprovar');
    expect(req.request.body).toEqual({ versao: 1 });
    req.flush(solicitacaoDaApi({ status: 'APROVADA', versao: 2 }));

    expect(service.requests()[0]).toMatchObject({ status: 'APROVADA', versao: 2 });
  });

  it('CA-03.2: rejeita enviando o motivo', () => {
    service.load();
    responderCarga();

    service.decide(service.requests()[0], 'rejeitar', 'Fora do orçamento').subscribe();

    const req = http.expectOne('/api/solicitacoes/sol-001/rejeitar');
    expect(req.request.body).toEqual({ versao: 1, motivo: 'Fora do orçamento' });
    req.flush(solicitacaoDaApi({ status: 'REJEITADA', versao: 2 }));
  });

  it('US-07: busca a trilha e converte em etapas', () => {
    let nomes: string[] = [];
    service.loadTrail('sol-001').subscribe((etapas) => (nomes = etapas.map((e) => e.nome)));

    http.expectOne('/api/solicitacoes/sol-001/trilha').flush([eloDaApi({ sequencia: 1 })]);

    expect(nomes).toEqual(['Solicitação criada']);
  });

  describe('Polling Inteligente (Abordagem 1)', () => {
    it('loadSilent(): carrega silenciosamente sem alterar loadState para carregando', () => {
      service.load();
      responderCarga();
      expect(service.loadState()).toBe('pronto');

      let resultado: RequestItem[] = [];
      service.loadSilent().subscribe((itens) => (resultado = itens));

      // loadState deve permanecer 'pronto' durante a requisição silenciosa
      expect(service.loadState()).toBe('pronto');

      http
        .expectOne('/api/solicitacoes?page=1&limit=50')
        .flush([solicitacaoDaApi({ id: 'sol-001', status: 'PENDENTE' })]);

      expect(service.loadState()).toBe('pronto');
      expect(resultado).toHaveLength(1);
    });

    it('loadSilent(): detecta transição de PENDENTE para APROVADA e emite em statusEvents$', () => {
      service.load();
      responderCarga([solicitacaoDaApi({ id: 'sol-001', codigo: '#SOL-001', status: 'PENDENTE' })]);

      const eventos: RequestStatusChangeEvent[] = [];
      const sub = service.statusEvents$.subscribe((ev) => eventos.push(ev));

      service.loadSilent().subscribe();
      http
        .expectOne('/api/solicitacoes?page=1&limit=50')
        .flush([solicitacaoDaApi({ id: 'sol-001', codigo: '#SOL-001', status: 'APROVADA', versao: 2 })]);

      expect(eventos).toHaveLength(1);
      expect(eventos[0]).toMatchObject({
        type: 'APROVADA',
        statusAnterior: 'PENDENTE',
      });
      expect(eventos[0].request.id).toBe('sol-001');
      expect(eventos[0].request.status).toBe('APROVADA');
      sub.unsubscribe();
    });

    it('loadSilent(): detecta transição para REJEITADA e EM_AJUSTE', () => {
      service.load();
      responderCarga([
        solicitacaoDaApi({ id: 'sol-001', codigo: '#SOL-001', status: 'PENDENTE' }),
        solicitacaoDaApi({ id: 'sol-002', codigo: '#SOL-002', status: 'PENDENTE' }),
      ]);

      const eventos: RequestStatusChangeEvent[] = [];
      const sub = service.statusEvents$.subscribe((ev) => eventos.push(ev));

      service.loadSilent().subscribe();
      http
        .expectOne('/api/solicitacoes?page=1&limit=50')
        .flush([
          solicitacaoDaApi({ id: 'sol-001', codigo: '#SOL-001', status: 'REJEITADA', versao: 2 }),
          solicitacaoDaApi({ id: 'sol-002', codigo: '#SOL-002', status: 'EM_AJUSTE', versao: 2 }),
        ]);

      expect(eventos).toHaveLength(2);
      expect(eventos[0].type).toBe('REJEITADA');
      expect(eventos[1].type).toBe('EM_AJUSTE');
      sub.unsubscribe();
    });

    it('loadSilent(): detecta nova solicitação pendente que ingressa na esteira', () => {
      service.load();
      responderCarga([solicitacaoDaApi({ id: 'sol-001', codigo: '#SOL-001', status: 'PENDENTE' })]);

      const eventos: RequestStatusChangeEvent[] = [];
      const sub = service.statusEvents$.subscribe((ev) => eventos.push(ev));

      service.loadSilent().subscribe();
      http
        .expectOne('/api/solicitacoes?page=1&limit=50')
        .flush([
          solicitacaoDaApi({ id: 'sol-001', codigo: '#SOL-001', status: 'PENDENTE' }),
          solicitacaoDaApi({ id: 'sol-999', codigo: '#SOL-999', status: 'PENDENTE' }),
        ]);

      expect(eventos).toHaveLength(1);
      expect(eventos[0]).toMatchObject({
        type: 'NOVA',
      });
      expect(eventos[0].request.id).toBe('sol-999');
      sub.unsubscribe();
    });

    it('startPolling() e stopPolling(): controlam o ciclo de vida da subscrição de polling', () => {
      expect(service.isPolling).toBe(false);

      service.startPolling(5000);
      expect(service.isPolling).toBe(true);

      // Chamar startPolling novamente reutiliza a mesma subscription (incrementa contador)
      service.startPolling(5000);
      expect(service.isPolling).toBe(true);

      // Primeiro stopPolling apenas decrementa
      service.stopPolling();
      expect(service.isPolling).toBe(true);

      // Segundo stopPolling encerra a subscription
      service.stopPolling();
      expect(service.isPolling).toBe(false);
    });
  });
});
