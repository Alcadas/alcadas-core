import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { APP_CONFIG } from '../config/app-config';
import { criarJwtDeTeste } from '../testing/fake-jwt';
import { CONFIG_DE_TESTE } from '../testing/test-config';
import { AuthService } from './auth.service';

const URL_LOGIN = `${CONFIG_DE_TESTE.auth.identityToolkitUrl}/accounts:signInWithPassword?key=chave-teste`;
const URL_RENOVACAO = `${CONFIG_DE_TESTE.auth.secureTokenUrl}/token?key=chave-teste`;

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;
  const idToken = criarJwtDeTeste({
    user_id: 'carlos',
    email: 'gerente@startop.test',
    name: 'Carlos',
    role: 'APROVADOR_N2',
    tenantId: 'startop',
  });

  function configurar(): void {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: APP_CONFIG, useValue: CONFIG_DE_TESTE }],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  }

  beforeEach(() => {
    sessionStorage.clear();
    configurar();
  });

  afterEach(() => http.verify());

  it('entra pelo Identity Toolkit e monta o usuário com as claims do token', () => {
    let usuario: unknown;
    service.login({ email: 'gerente@startop.test', password: 'senha123' }).subscribe((u) => (usuario = u));

    const req = http.expectOne(URL_LOGIN);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'gerente@startop.test', password: 'senha123', returnSecureToken: true });
    req.flush({ idToken, refreshToken: 'refresh-1', expiresIn: '3600' });

    expect(usuario).toEqual({
      id: 'carlos',
      email: 'gerente@startop.test',
      name: 'Carlos',
      role: 'APROVADOR_N2',
      tenantId: 'startop',
    });
    expect(service.isAuthenticated()).toBe(true);
    expect(service.getToken()).toBe(idToken);
  });

  it('traduz credencial inválida para mensagem em português', () => {
    let mensagem = '';
    service.login({ email: 'x@y.z', password: 'errada' }).subscribe({ error: (e: Error) => (mensagem = e.message) });

    http.expectOne(URL_LOGIN).flush(
      { error: { code: 400, message: 'INVALID_LOGIN_CREDENTIALS' } },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(mensagem).toBe('E-mail ou senha incorretos.');
    expect(service.isAuthenticated()).toBe(false);
  });

  it('mantém a sessão no sessionStorage ao recarregar a página', () => {
    service.login({ email: 'gerente@startop.test', password: 'senha123' }).subscribe();
    http.expectOne(URL_LOGIN).flush({ idToken, refreshToken: 'refresh-1', expiresIn: '3600' });

    TestBed.resetTestingModule();
    configurar();

    expect(service.isAuthenticated()).toBe(true);
    expect(service.currentUser()?.tenantId).toBe('startop');
  });

  it('logout limpa a sessão', () => {
    service.login({ email: 'gerente@startop.test', password: 'senha123' }).subscribe();
    http.expectOne(URL_LOGIN).flush({ idToken, refreshToken: 'refresh-1', expiresIn: '3600' });

    service.logout();

    expect(service.isAuthenticated()).toBe(false);
    expect(sessionStorage.getItem('alcadas.sessao')).toBeNull();
  });

  it('devolve o token atual quando ainda está longe de expirar', () => {
    service.login({ email: 'gerente@startop.test', password: 'senha123' }).subscribe();
    http.expectOne(URL_LOGIN).flush({ idToken, refreshToken: 'refresh-1', expiresIn: '3600' });

    let token: string | null = null;
    service.obterTokenValido().subscribe((t) => (token = t));

    expect(token).toBe(idToken);
  });

  it('renova o token perto de expirar, com uma única chamada para requisições simultâneas', () => {
    service.login({ email: 'gerente@startop.test', password: 'senha123' }).subscribe();
    http.expectOne(URL_LOGIN).flush({ idToken, refreshToken: 'refresh-1', expiresIn: '30' });

    const tokens: Array<string | null> = [];
    service.obterTokenValido().subscribe((t) => tokens.push(t));
    service.obterTokenValido().subscribe((t) => tokens.push(t));

    const req = http.expectOne(URL_RENOVACAO);
    expect(req.request.body).toBe('grant_type=refresh_token&refresh_token=refresh-1');
    req.flush({ id_token: 'novo-token', refresh_token: 'refresh-2', expires_in: '3600' });

    expect(tokens).toEqual(['novo-token', 'novo-token']);
    expect(service.getToken()).toBe('novo-token');
  });

  it('encerra a sessão se a renovação falhar', () => {
    service.login({ email: 'gerente@startop.test', password: 'senha123' }).subscribe();
    http.expectOne(URL_LOGIN).flush({ idToken, refreshToken: 'refresh-1', expiresIn: '30' });

    let token: string | null = 'nao-chamado';
    service.obterTokenValido().subscribe((t) => (token = t));
    http.expectOne(URL_RENOVACAO).flush({}, { status: 400, statusText: 'Bad Request' });

    expect(token).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
  });
});
