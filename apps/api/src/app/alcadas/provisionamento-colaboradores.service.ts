import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { Auth, getAuth, UserRecord } from 'firebase-admin/auth';
import { getFirebaseApp } from '../firebase/firebase-app';

/** Dados do colaborador necessários para criar/atualizar a conta no Firebase Auth. */
export interface ColaboradorParaProvisionar {
  id: string;
  fullName: string;
  email: string;
  role: string;
  departmentId?: string;
  departmentName?: string;
  approvalLimit?: number;
  status?: string;
  /** Aceita apenas fora de produção (emulador). Em produção é ignorada. */
  password?: string;
}

/** Departamento do colaborador, usado para derivar o centro de custo das claims. */
export interface DepartamentoDoColaborador {
  id: string;
  name: string;
  costCenter?: string;
}

/** Totais de uma sincronização. Só números: nenhum dado pessoal sai daqui para o log. */
export interface ResultadoProvisionamento {
  criados: number;
  atualizados: number;
  /** Contas que já pertencem a outra empresa ou à plataforma — nunca são alteradas. */
  ignorados: number;
  convitesEnviados: number;
  falhas: number;
}

/** Senha usada apenas no Auth Emulator, para o login de desenvolvimento continuar simples. */
const SENHA_PADRAO_EMULADOR = '123456';

const URL_IDENTITY_TOOLKIT = 'https://identitytoolkit.googleapis.com/v1';

/**
 * Converte o cargo cadastrado na tela de Organização no papel (claim `role`) usado pelo RBAC da API.
 * Nunca devolve `SUPER_USER`: papel de plataforma não é atribuível por cadastro de colaborador.
 */
export function mapRoleToClaim(role: string): string {
  switch (role) {
    case 'DIRETOR':
    case 'CFO':
      return 'DIRETOR_CFO';
    case 'ADMINISTRADOR':
      return 'ADMIN';
    case 'GERENTE':
      return 'APROVADOR_N2';
    case 'ANALISTA':
      return 'APROVADOR_N1';
    case 'AUDITOR':
      return 'AUDITOR';
    default:
      return 'SOLICITANTE';
  }
}

/**
 * Provisiona os colaboradores de uma empresa no Firebase Auth (Issue #32 / RF01).
 *
 * Para cada colaborador com e-mail:
 * - cria (ou atualiza) a conta e grava as custom claims `tenantId`, `role` e `roles`, que são o que
 *   o `JwtAuthGuard` lê do token para aplicar isolamento multi-tenant e RBAC;
 * - em produção a conta nasce SEM senha e o colaborador recebe o e-mail de definição de senha do
 *   próprio Firebase — a API nunca define, recebe ou registra senha de colaborador;
 * - contas que já pertencem a outra empresa (ou a um `SUPER_USER`) não são tocadas, para que o
 *   administrador de um tenant não consiga sequestrar a conta de outro informando o mesmo e-mail.
 *
 * Fora de produção (Auth Emulator) mantém a senha de desenvolvimento, sem envio de e-mail.
 */
@Injectable()
export class ProvisionamentoColaboradoresService {
  private readonly logger = new Logger(ProvisionamentoColaboradoresService.name);

  /**
   * Sincroniza a lista de colaboradores do tenant com o Firebase Auth.
   * Nunca lança: falhas individuais são contadas em `falhas` para não derrubar o cadastro da empresa.
   *
   * @example
   * const r = await provisionamento.sincronizar('startop', organizacao.employees, organizacao.departments);
   * // r => { criados: 1, atualizados: 3, ignorados: 0, convitesEnviados: 1, falhas: 0 }
   */
  async sincronizar(
    tenantId: string,
    colaboradores: ColaboradorParaProvisionar[],
    departamentos: DepartamentoDoColaborador[] = [],
  ): Promise<ResultadoProvisionamento> {
    const resultado: ResultadoProvisionamento = {
      criados: 0,
      atualizados: 0,
      ignorados: 0,
      convitesEnviados: 0,
      falhas: 0,
    };

    let auth: Auth;
    try {
      auth = getAuth(getFirebaseApp());
    } catch (erro) {
      this.logger.error(`Firebase Auth indisponível para provisionamento (${this.codigoDoErro(erro)}).`);
      resultado.falhas = colaboradores.length;
      return resultado;
    }

    for (const colaborador of colaboradores) {
      if (!colaborador?.email) continue;
      try {
        await this.provisionar(auth, tenantId, colaborador, departamentos, resultado);
      } catch (erro) {
        resultado.falhas++;
        // Só o código do erro: e-mail e nome do colaborador não vão para o log (RNF09).
        this.logger.warn(`Falha ao provisionar colaborador no Firebase Auth (${this.codigoDoErro(erro)}).`);
      }
    }

    if (this.emProducao()) {
      this.logger.log(
        `Provisionamento no Firebase Auth: ${resultado.criados} criado(s), ${resultado.atualizados} atualizado(s), ` +
          `${resultado.ignorados} ignorado(s), ${resultado.convitesEnviados} convite(s), ${resultado.falhas} falha(s).`,
      );
    }
    return resultado;
  }

  private async provisionar(
    auth: Auth,
    tenantId: string,
    colaborador: ColaboradorParaProvisionar,
    departamentos: DepartamentoDoColaborador[],
    resultado: ResultadoProvisionamento,
  ): Promise<void> {
    const producao = this.emProducao();
    const email = colaborador.email.trim().toLowerCase();
    const inativo = colaborador.status === 'INATIVO';
    const claims = this.montarClaims(tenantId, colaborador, departamentos);
    // Senha só existe no emulador; em produção quem define é o próprio colaborador.
    const senhaDoEmulador = producao
      ? undefined
      : colaborador.password && colaborador.password.length >= 6
        ? colaborador.password
        : SENHA_PADRAO_EMULADOR;

    const existente = await this.buscarPorEmail(auth, email);

    if (existente) {
      const tenantAtual = existente.customClaims?.['tenantId'];
      const papelAtual = existente.customClaims?.['role'];
      if ((tenantAtual && tenantAtual !== tenantId) || papelAtual === 'SUPER_USER') {
        resultado.ignorados++;
        return;
      }
      await auth.updateUser(existente.uid, {
        displayName: colaborador.fullName,
        disabled: inativo,
        ...(senhaDoEmulador ? { password: senhaDoEmulador } : {}),
      });
      await auth.setCustomUserClaims(existente.uid, claims);
      resultado.atualizados++;
      return;
    }

    const criado = await auth.createUser({
      uid: `${tenantId}-${colaborador.id}`,
      email,
      displayName: colaborador.fullName,
      disabled: inativo,
      // Em produção o e-mail só é considerado verificado quando o colaborador usa o link recebido.
      emailVerified: !producao,
      ...(senhaDoEmulador ? { password: senhaDoEmulador } : {}),
    });
    await auth.setCustomUserClaims(criado.uid, claims);
    resultado.criados++;

    if (producao && !inativo && (await this.enviarConviteDeSenha(email))) {
      resultado.convitesEnviados++;
    }
  }

  /** Claims lidas pelo `JwtAuthGuard`: empresa, papel e dados de alçada do colaborador. */
  private montarClaims(
    tenantId: string,
    colaborador: ColaboradorParaProvisionar,
    departamentos: DepartamentoDoColaborador[],
  ): Record<string, unknown> {
    const role = mapRoleToClaim(colaborador.role);
    const departamento = departamentos.find(
      (d) => d.id === colaborador.departmentId || d.name === colaborador.departmentName,
    );
    return {
      tenantId,
      role,
      roles: [role],
      name: colaborador.fullName,
      departmentId: colaborador.departmentId || null,
      departmentName: colaborador.departmentName || null,
      costCenterId: departamento?.costCenter || departamento?.id || null,
      limiteAlcada: colaborador.approvalLimit ?? null,
    };
  }

  /** Devolve `null` quando não há conta com o e-mail; qualquer outro erro é propagado. */
  private async buscarPorEmail(auth: Auth, email: string): Promise<UserRecord | null> {
    try {
      return await auth.getUserByEmail(email);
    } catch (erro) {
      if (this.codigoDoErro(erro) === 'auth/user-not-found') {
        return null;
      }
      throw erro;
    }
  }

  /**
   * Pede ao Firebase Auth que envie ao colaborador o e-mail de definição de senha
   * (`accounts:sendOobCode`, `PASSWORD_RESET`). O link vai direto para a caixa de entrada do
   * colaborador e não passa pela API nem pelo administrador da empresa.
   *
   * Depende de `FIREBASE_API_KEY` (a chave Web do projeto, que é pública). Sem ela nada é enviado e
   * o colaborador define a senha pelo "Esqueci minha senha" da tela de login.
   */
  private async enviarConviteDeSenha(email: string): Promise<boolean> {
    const chave = process.env['FIREBASE_API_KEY'];
    if (!chave) {
      this.logger.warn(
        'FIREBASE_API_KEY ausente: convite de definição de senha não enviado (usar "Esqueci minha senha").',
      );
      return false;
    }
    try {
      await axios.post(
        `${URL_IDENTITY_TOOLKIT}/accounts:sendOobCode`,
        { requestType: 'PASSWORD_RESET', email },
        { params: { key: chave }, timeout: 5000 },
      );
      return true;
    } catch (erro) {
      const status = axios.isAxiosError(erro) ? erro.response?.status ?? 'sem resposta' : 'erro';
      this.logger.warn(`Falha ao enviar convite de definição de senha (HTTP ${status}).`);
      return false;
    }
  }

  private emProducao(): boolean {
    return process.env['NODE_ENV'] === 'production';
  }

  private codigoDoErro(erro: unknown): string {
    const codigo = (erro as { code?: unknown } | null)?.code;
    return typeof codigo === 'string' ? codigo : erro instanceof Error ? erro.name : 'erro-desconhecido';
  }
}
