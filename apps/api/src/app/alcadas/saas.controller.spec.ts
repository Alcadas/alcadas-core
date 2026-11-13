import { BadRequestException } from '@nestjs/common';
import { AuthenticatedUser, MODELOS_REGRAS_ALCADA } from '@alcadas-core/models';
import { FirestoreService } from '../database/firestore.service';
import { AlcadasService } from './alcadas.service';
import { SaasController } from './saas.controller';

describe('SaasController — PUT /organizacao/fluxos (#69)', () => {
  const user = { tenantId: 'tenant-a', role: 'ADMIN' } as AuthenticatedUser;
  let setTenantDocument: jest.Mock;
  let controller: SaasController;

  beforeEach(() => {
    setTenantDocument = jest.fn().mockResolvedValue(undefined);
    const firestore = { setTenantDocument } as unknown as FirestoreService;
    controller = new SaasController(firestore, {} as AlcadasService);
  });

  const regraDoModelo = () => {
    const modelo = MODELOS_REGRAS_ALCADA[0];
    return {
      id: 'rule-tpl-1',
      name: modelo.nome,
      modeloId: modelo.id,
      faixas: modelo.faixas.map((f) => ({ ...f })),
    };
  };

  it('persiste no Firestore uma regra criada a partir de modelo', async () => {
    const regra = regraDoModelo();
    const res = await controller.saveTenantWorkflowsAndRules(user, { rulesCatalog: [regra] });

    expect(res).toEqual({ savedWorkflows: 0, savedRules: 1 });
    expect(setTenantDocument).toHaveBeenCalledWith('tenant-a', 'rules_catalog', 'rule-tpl-1', regra);
  });

  it('recusa com 400 faixas com mínimo >= máximo e não grava nada', async () => {
    const valida = regraDoModelo();
    const invalida = {
      ...regraDoModelo(),
      id: 'rule-bad',
      faixas: [{ id: 'f1', valorMinimo: 1000, valorMaximo: 500, papelAprovador: 'GERENTE' }],
    };

    await expect(
      controller.saveTenantWorkflowsAndRules(user, { rulesCatalog: [valida, invalida] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(setTenantDocument).not.toHaveBeenCalled();
  });

  it('recusa regra com faixas mas sem nome', async () => {
    await expect(
      controller.saveTenantWorkflowsAndRules(user, {
        rulesCatalog: [{ ...regraDoModelo(), name: '  ' }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('continua aceitando regras legadas sem faixas', async () => {
    const res = await controller.saveTenantWorkflowsAndRules(user, {
      rulesCatalog: [{ id: 'rule-legacy', name: 'Legada', ceilingAmount: 5000 }],
    });
    expect(res.savedRules).toBe(1);
  });
});
