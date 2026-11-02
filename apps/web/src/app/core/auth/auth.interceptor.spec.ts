import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { APP_CONFIG } from '../config/app-config';
import { CONFIG_DE_TESTE } from '../testing/test-config';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let authService: { obterTokenValido: jest.Mock; logout: jest.Mock };
  let router: Router;

  beforeEach(() => {
    authService = { obterTokenValido: jest.fn().mockReturnValue(of('token-123')), logout: jest.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: APP_CONFIG, useValue: CONFIG_DE_TESTE },
        { provide: AuthService, useValue: authService },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => backend.verify());

  it('envia o Bearer token nas chamadas à API', () => {
    http.get('/api/solicitacoes').subscribe();

    const req = backend.expectOne('/api/solicitacoes');
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-123');
    req.flush([]);
  });

  it('não envia o token para fora da API (ex.: Firebase Auth)', () => {
    http.post(`${CONFIG_DE_TESTE.auth.identityToolkitUrl}/accounts:signInWithPassword`, {}).subscribe();

    const req = backend.expectOne(`${CONFIG_DE_TESTE.auth.identityToolkitUrl}/accounts:signInWithPassword`);
    expect(req.request.headers.has('Authorization')).toBe(false);
    expect(authService.obterTokenValido).not.toHaveBeenCalled();
    req.flush({});
  });

  it('segue sem cabeçalho quando não há sessão', () => {
    authService.obterTokenValido.mockReturnValue(of(null));
    http.get('/api/solicitacoes').subscribe();

    const req = backend.expectOne('/api/solicitacoes');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush([]);
  });

  it('CA-09.2: resposta 401 encerra a sessão e volta para o login', () => {
    const navegar = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    let status = 0;
    http.get('/api/solicitacoes').subscribe({ error: (e: { status: number }) => (status = e.status) });

    backend.expectOne('/api/solicitacoes').flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(status).toBe(401);
    expect(authService.logout).toHaveBeenCalled();
    expect(navegar).toHaveBeenCalledWith(['/login']);
  });
});
