import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { MODELOS_REGRAS_ALCADA } from '@alcadas-core/models';
import { LimitsService } from './limits.service';

describe('LimitsService', () => {
  let service: LimitsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        LimitsService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(LimitsService);
  });

  it('deve instanciar o serviço', () => {
    expect(service).toBeTruthy();
    expect(service.marketModels.length).toBeGreaterThanOrEqual(4);
  });

  it('deve criar regra de alçada a partir de modelo pré-definido', () => {
    const modelo = MODELOS_REGRAS_ALCADA[0];
    const rule = service.createRuleFromModelo(modelo, {
      nome: 'Reembolso Customizado',
    });

    expect(rule.title).toBe('Reembolso Customizado');
    expect(rule.modeloId).toBe(modelo.id);
    expect(rule.nodes?.length).toBeGreaterThan(0);
    expect(service.getRuleById(rule.id)).toBeDefined();
  });

  it('deve atualizar regra existente', () => {
    const created = service.createRule({ title: 'Regra Inicial' });
    const updated = service.updateRule(created.id, { title: 'Regra Atualizada', ceilingAmount: 90000 });

    expect(updated?.title).toBe('Regra Atualizada');
    expect(updated?.ceilingAmount).toBe(90000);
    expect(service.getRuleById(created.id)?.title).toBe('Regra Atualizada');
  });

  it('deve salvar e atualizar workflow com nós', () => {
    const saved = service.saveWorkflow('FLX-1234', {
      title: 'Fluxo Via Editor',
      department: 'Tecnologia da Informação',
      status: 'ACTIVE',
      nodes: [
        {
          id: 'n1',
          type: 'TRIGGER',
          title: 'Início',
          subtitle: '',
          tag: '',
          tagColor: '',
          icon: '',
          config: {},
        },
        {
          id: 'n2',
          type: 'CONDITION_VALUE',
          title: 'Teto 15k',
          subtitle: '',
          tag: '',
          tagColor: '',
          icon: '',
          config: { valueMax: 15000 },
        },
      ],
    });

    expect(saved.id).toBe('FLX-1234');
    expect(saved.title).toBe('Fluxo Via Editor');
    expect(saved.ceilingAmount).toBe(15000);
    expect(saved.nodes?.length).toBe(2);
  });
});
