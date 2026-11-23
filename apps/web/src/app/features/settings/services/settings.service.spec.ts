import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { APP_CONFIG } from '../../../core/config/app-config';
import { CONFIG_DE_TESTE } from '../../../core/testing/test-config';
import {
  SettingsService,
  mapearRoleParaCargoPadrao,
  mapearRoleParaLimitePadrao,
  obterFuncionalidadesPadraoPorRole,
} from './settings.service';

describe('SettingsService - RBAC & SoD (RN03 / RF01 / ADR-007)', () => {
  let service: SettingsService;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: CONFIG_DE_TESTE },
      ],
    });
    service = TestBed.inject(SettingsService);
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  describe('obterFuncionalidadesPadraoPorRole', () => {
    it('SOLICITANTE deve ter apenas dashboard e solicitacoes', () => {
      const features = obterFuncionalidadesPadraoPorRole('SOLICITANTE');
      expect(features).toEqual(['dashboard', 'solicitacoes']);
      expect(features).not.toContain('minhas_aprovacoes');
      expect(features).not.toContain('meus_fluxos');
      expect(features).not.toContain('minhas_regras');
      expect(features).not.toContain('organizacao');
      expect(features).not.toContain('delegacoes');
    });

    it('APROVADOR_N2 (Gerente) deve ter dashboard, minhas_aprovacoes e meus_fluxos, sem emissão de solicitações (SoD)', () => {
      const features = obterFuncionalidadesPadraoPorRole('APROVADOR_N2');
      expect(features).toEqual(['dashboard', 'minhas_aprovacoes', 'meus_fluxos']);
      expect(features).not.toContain('solicitacoes');
      expect(features).not.toContain('minhas_regras');
      expect(features).not.toContain('organizacao');
    });

    it('GERENTE deve mapear para as mesmas permissões de APROVADOR_N2', () => {
      const features = obterFuncionalidadesPadraoPorRole('GERENTE');
      expect(features).toEqual(['dashboard', 'minhas_aprovacoes', 'meus_fluxos']);
    });

    it('DIRETOR_CFO deve ter aprovação, fluxos, regras, auditoria e gestão corporativa, sem emitir solicitações (SoD)', () => {
      const features = obterFuncionalidadesPadraoPorRole('DIRETOR_CFO');
      expect(features).toContain('dashboard');
      expect(features).toContain('minhas_aprovacoes');
      expect(features).toContain('meus_fluxos');
      expect(features).toContain('minhas_regras');
      expect(features).toContain('trilha');
      expect(features).toContain('motor_riscos');
      expect(features).toContain('delegacoes');
      expect(features).toContain('organizacao');
      expect(features).not.toContain('solicitacoes');
    });

    it('AUDITOR deve ter apenas dashboard, trilha e motor_riscos', () => {
      const features = obterFuncionalidadesPadraoPorRole('AUDITOR');
      expect(features).toEqual(['dashboard', 'trilha', 'motor_riscos']);
      expect(features).not.toContain('solicitacoes');
      expect(features).not.toContain('minhas_aprovacoes');
    });

    it('SUPER_USER deve ter todas as funcionalidades mais clientes', () => {
      const features = obterFuncionalidadesPadraoPorRole('SUPER_USER');
      expect(features).toContain('clientes');
      expect(features).toContain('organizacao');
      expect(features).toContain('minhas_regras');
    });

    it('Papel desconhecido deve cair no princípio do menor privilégio (apenas dashboard e solicitacoes)', () => {
      const features = obterFuncionalidadesPadraoPorRole('PAPEL_INEXISTENTE');
      expect(features).toEqual(['dashboard', 'solicitacoes']);
    });
  });

  describe('mapearRoleParaCargoPadrao e mapearRoleParaLimitePadrao', () => {
    it('mapeia corretamente papéis para cargos amigáveis', () => {
      expect(mapearRoleParaCargoPadrao('SOLICITANTE')).toBe('Analista de Operações');
      expect(mapearRoleParaCargoPadrao('APROVADOR_N2')).toBe('Gerente Departamental');
      expect(mapearRoleParaCargoPadrao('GERENTE')).toBe('Gerente Departamental');
      expect(mapearRoleParaCargoPadrao('DIRETOR_CFO')).toBe('Diretor de Operações');
      expect(mapearRoleParaCargoPadrao('CFO')).toBe('Diretor Financeiro (CFO)');
      expect(mapearRoleParaCargoPadrao('SUPER_USER')).toBe('Desenvolvedor (Super Admin)');
      expect(mapearRoleParaCargoPadrao(undefined)).toBe('Analista de Operações');
    });

    it('mapeia limites padrão por papel', () => {
      expect(mapearRoleParaLimitePadrao('SOLICITANTE')).toBe(0);
      expect(mapearRoleParaLimitePadrao('APROVADOR_N1')).toBe(15000);
      expect(mapearRoleParaLimitePadrao('APROVADOR_N2')).toBe(75000);
      expect(mapearRoleParaLimitePadrao('DIRETOR_CFO')).toBe(200000);
      expect(mapearRoleParaLimitePadrao('CFO')).toBe(1000000);
    });
  });

  describe('Sessão e Permissões do Usuário (SettingsService)', () => {
    it('usuário seed solicitante@startop.com.br não deve ter acesso a aprovações ou regras', () => {
      service.syncSessionContext({
        email: 'solicitante@startop.com.br',
        tenantId: 'startop',
        name: 'Solicitante Startop',
        role: 'SOLICITANTE',
      });

      const allowed = service.currentUserAllowedFeatures();
      expect(allowed).toContain('solicitacoes');
      expect(allowed).not.toContain('minhas_aprovacoes');
      expect(allowed).not.toContain('meus_fluxos');
      expect(allowed).not.toContain('minhas_regras');
      expect(allowed).not.toContain('organizacao');
      expect(allowed).not.toContain('delegacoes');

      expect(service.canCurrentUserAccessUrl('/solicitacoes')).toBe(true);
      expect(service.canCurrentUserAccessUrl('/aprovacoes')).toBe(false);
      expect(service.canCurrentUserAccessUrl('/alcadas/regras')).toBe(false);
      expect(service.canCurrentUserAccessUrl('/configuracoes/organizacao')).toBe(false);
      expect(service.canCurrentUserAccessUrl('/configuracoes/delegacoes')).toBe(false);
    });

    it('usuário seed solicitante deve ter perfil com cargo correto e nunca Desenvolvedor', () => {
      service.syncSessionContext({
        email: 'solicitante@startop.com.br',
        tenantId: 'startop',
        name: 'Solicitante Startop',
        role: 'SOLICITANTE',
      });

      const profile = service.userProfile();
      expect(profile.jobTitle).not.toBe('Desenvolvedor (Super Admin)');
      expect(profile.jobTitle).toBe('Analista de Operações');
      expect(profile.approvalLimit).toBe(0);
    });

    it('usuário seed gerente@startop.com.br deve ter acesso a aprovações e fluxos, sem regras corporativas ou solicitação (SoD)', () => {
      service.syncSessionContext({
        email: 'gerente@startop.com.br',
        tenantId: 'startop',
        name: 'Gerente Startop',
        role: 'APROVADOR_N2',
      });

      const allowed = service.currentUserAllowedFeatures();
      expect(allowed).toContain('dashboard');
      expect(allowed).toContain('minhas_aprovacoes');
      expect(allowed).toContain('meus_fluxos');
      expect(allowed).not.toContain('solicitacoes');
      expect(allowed).not.toContain('minhas_regras');
      expect(allowed).not.toContain('organizacao');

      expect(service.canCurrentUserAccessUrl('/aprovacoes')).toBe(true);
      expect(service.canCurrentUserAccessUrl('/alcadas/minhas-alcadas')).toBe(true);
      expect(service.canCurrentUserAccessUrl('/solicitacoes')).toBe(false);
      expect(service.canCurrentUserAccessUrl('/alcadas/regras')).toBe(false);
      expect(service.canCurrentUserAccessUrl('/configuracoes/organizacao')).toBe(false);

      const profile = service.userProfile();
      expect(profile.jobTitle).toBe('Gerente Departamental');
      expect(profile.approvalLimit).toBe(75000);
    });

    it('usuário não cadastrado com role SOLICITANTE deve receber fallback seguro', () => {
      service.syncSessionContext({
        email: 'novo.usuario@startop.com.br',
        tenantId: 'startop',
        name: 'Novo Usuário',
        role: 'SOLICITANTE',
      });

      const allowed = service.currentUserAllowedFeatures();
      expect(allowed).toEqual(['dashboard', 'solicitacoes']);

      const profile = service.userProfile();
      expect(profile.jobTitle).toBe('Analista de Operações');
      expect(profile.approvalLimit).toBe(0);
    });
  });
});
