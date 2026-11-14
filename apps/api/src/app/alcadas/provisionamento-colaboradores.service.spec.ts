import axios from 'axios';
import * as adminAuth from 'firebase-admin/auth';
import {
  ColaboradorParaProvisionar,
  mapRoleToClaim,
  ProvisionamentoColaboradoresService,
} from './provisionamento-colaboradores.service';

jest.mock('firebase-admin/auth', () => ({ getAuth: jest.fn() }));
jest.mock('../firebase/firebase-app', () => ({ getFirebaseApp: jest.fn(() => ({})) }));
jest.mock('axios', () => ({
  __esModule: true,
  default: { post: jest.fn(), isAxiosError: jest.fn(() => true) },
}));

const naoEncontrado = () => Object.assign(new Error('nao encontrado'), { code: 'auth/user-not-found' });

describe('ProvisionamentoColaboradoresService (Issue #32)', () => {
  const envOriginal = { ...process.env };
  let servico: ProvisionamentoColaboradoresService;
  let auth: {
    getUserByEmail: jest.Mock;
    createUser: jest.Mock;
    updateUser: jest.Mock;
    setCustomUserClaims: jest.Mock;
  };
  const post = (axios as unknown as { post: jest.Mock }).post;

  const gerente: ColaboradorParaProvisionar = {
    id: 'emp-ger',
    fullName: 'Mariana Vasconcelos',
    email: '  Gerente@Startop.com.br ',
    role: 'GERENTE',
    departmentId: 'dep-fin',
    departmentName: 'Finanças',
    approvalLimit: 75000,
    status: 'ATIVO',
    password: 'senha-vinda-do-payload',
  };
  const departamentos = [{ id: 'dep-fin', name: 'Finanças', costCenter: 'CC-101' }];

  beforeEach(() => {
    auth = {
      getUserByEmail: jest.fn().mockRejectedValue(naoEncontrado()),
      createUser: jest.fn().mockImplementation(async (dados: { uid: string }) => ({ uid: dados.uid })),
      updateUser: jest.fn().mockResolvedValue(undefined),
      setCustomUserClaims: jest.fn().mockResolvedValue(undefined),
    };
    (adminAuth.getAuth as jest.Mock).mockReturnValue(auth);
    post.mockReset().mockResolvedValue({ data: {} });
    servico = new ProvisionamentoColaboradoresService();
  });

  afterEach(() => {
    process.env = { ...envOriginal };
  });

  describe('em produção', () => {
    beforeEach(() => {
      process.env['NODE_ENV'] = 'production';
      process.env['FIREBASE_API_KEY'] = 'chave-web-publica';
    });

    it('cria a conta sem senha, com as claims de empresa e papel, e envia o convite de senha', async () => {
      const resultado = await servico.sincronizar('startop', [gerente], departamentos);

      expect(resultado).toEqual({ criados: 1, atualizados: 0, ignorados: 0, convitesEnviados: 1, falhas: 0 });
      expect(auth.createUser).toHaveBeenCalledWith({
        uid: 'startop-emp-ger',
        email: 'gerente@startop.com.br',
        displayName: 'Mariana Vasconcelos',
        disabled: false,
        emailVerified: false,
      });
      expect(auth.createUser.mock.calls[0][0]).not.toHaveProperty('password');
      expect(auth.setCustomUserClaims).toHaveBeenCalledWith('startop-emp-ger', {
        tenantId: 'startop',
        role: 'APROVADOR_N2',
        roles: ['APROVADOR_N2'],
        name: 'Mariana Vasconcelos',
        departmentId: 'dep-fin',
        departmentName: 'Finanças',
        costCenterId: 'CC-101',
        limiteAlcada: 75000,
      });
      expect(post).toHaveBeenCalledWith(
        'https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode',
        { requestType: 'PASSWORD_RESET', email: 'gerente@startop.com.br' },
        expect.objectContaining({ params: { key: 'chave-web-publica' } }),
      );
    });

    it('nunca usa a senha fixa 123456 nem a senha enviada no payload', async () => {
      auth.getUserByEmail.mockResolvedValueOnce({ uid: 'u-1', customClaims: { tenantId: 'startop' } });
      await servico.sincronizar('startop', [gerente, { ...gerente, id: 'emp-2', email: 'novo@startop.com.br' }]);

      const chamadas = JSON.stringify([auth.createUser.mock.calls, auth.updateUser.mock.calls]);
      expect(chamadas).not.toContain('123456');
      expect(chamadas).not.toContain('senha-vinda-do-payload');
      expect(chamadas).not.toContain('password');
    });

    it('atualiza colaborador já existente da mesma empresa sem reenviar convite', async () => {
      auth.getUserByEmail.mockResolvedValue({ uid: 'u-1', customClaims: { tenantId: 'startop', role: 'SOLICITANTE' } });

      const resultado = await servico.sincronizar('startop', [{ ...gerente, status: 'INATIVO' }], departamentos);

      expect(resultado).toMatchObject({ criados: 0, atualizados: 1, convitesEnviados: 0 });
      expect(auth.updateUser).toHaveBeenCalledWith('u-1', { displayName: 'Mariana Vasconcelos', disabled: true });
      expect(auth.setCustomUserClaims).toHaveBeenCalledWith('u-1', expect.objectContaining({ role: 'APROVADOR_N2' }));
      expect(post).not.toHaveBeenCalled();
    });

    it('não toca em conta que pertence a outra empresa (impede sequestro por e-mail)', async () => {
      auth.getUserByEmail.mockResolvedValue({ uid: 'u-outra', customClaims: { tenantId: 'empresa-b', role: 'ADMIN' } });

      const resultado = await servico.sincronizar('startop', [gerente]);

      expect(resultado).toMatchObject({ ignorados: 1, atualizados: 0, criados: 0 });
      expect(auth.updateUser).not.toHaveBeenCalled();
      expect(auth.setCustomUserClaims).not.toHaveBeenCalled();
    });

    it('não rebaixa nem altera um SUPER_USER da plataforma', async () => {
      auth.getUserByEmail.mockResolvedValue({ uid: 'u-root', customClaims: { tenantId: 'startop', role: 'SUPER_USER' } });

      const resultado = await servico.sincronizar('startop', [gerente]);

      expect(resultado.ignorados).toBe(1);
      expect(auth.setCustomUserClaims).not.toHaveBeenCalled();
    });

    it('sem FIREBASE_API_KEY cria a conta e apenas não envia o convite', async () => {
      delete process.env['FIREBASE_API_KEY'];

      const resultado = await servico.sincronizar('startop', [gerente]);

      expect(resultado).toMatchObject({ criados: 1, convitesEnviados: 0, falhas: 0 });
      expect(post).not.toHaveBeenCalled();
    });

    it('falha de um colaborador não interrompe os demais e é contada', async () => {
      auth.createUser.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'auth/invalid-email' }));

      const resultado = await servico.sincronizar('startop', [
        gerente,
        { ...gerente, id: 'emp-2', email: 'ok@startop.com.br' },
        { ...gerente, id: 'emp-3', email: '' },
      ]);

      expect(resultado).toMatchObject({ criados: 1, falhas: 1 });
    });
  });

  describe('fora de produção (Auth Emulator)', () => {
    beforeEach(() => {
      process.env['NODE_ENV'] = 'development';
    });

    it('mantém a senha de desenvolvimento e não envia e-mail', async () => {
      await servico.sincronizar('startop', [{ ...gerente, password: undefined }]);

      expect(auth.createUser).toHaveBeenCalledWith(
        expect.objectContaining({ password: '123456', emailVerified: true }),
      );
      expect(post).not.toHaveBeenCalled();
    });
  });

  describe('mapRoleToClaim', () => {
    it.each([
      ['DIRETOR', 'DIRETOR_CFO'],
      ['CFO', 'DIRETOR_CFO'],
      ['ADMINISTRADOR', 'ADMIN'],
      ['GERENTE', 'APROVADOR_N2'],
      ['ANALISTA', 'APROVADOR_N1'],
      ['AUDITOR', 'AUDITOR'],
      ['SOLICITANTE', 'SOLICITANTE'],
      ['SUPER_USER', 'SOLICITANTE'],
      ['qualquer-coisa', 'SOLICITANTE'],
    ])('cargo %s vira papel %s', (cargo, papel) => {
      expect(mapRoleToClaim(cargo)).toBe(papel);
    });
  });
});
