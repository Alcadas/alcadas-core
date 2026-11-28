import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { OrganizationComponent } from './organization.component';
import { SettingsService } from '../../services/settings.service';

describe('OrganizationComponent', () => {
  let component: OrganizationComponent;
  let fixture: ComponentFixture<OrganizationComponent>;
  let settingsService: SettingsService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrganizationComponent],
      providers: [SettingsService, provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(OrganizationComponent);
    component = fixture.componentInstance;
    settingsService = TestBed.inject(SettingsService);
    fixture.detectChanges();
  });

  it('deve criar o componente de organização', () => {
    expect(component).toBeTruthy();
  });

  it('deve alternar entre as abas de empresa, departamentos, funcionarios e politicas', () => {
    expect(component.activeTab()).toBe('company');
    component.selectTab('departments');
    expect(component.activeTab()).toBe('departments');
    component.selectTab('employees');
    expect(component.activeTab()).toBe('employees');
    component.selectTab('policies');
    expect(component.activeTab()).toBe('policies');
  });

  it('deve registrar um novo departamento', () => {
    const initialCount = settingsService.organization().departments.length;
    component.openNewDepartmentForm();
    component.deptForm.setValue({
      code: 'MKT',
      name: 'Marketing & Growth',
      costCenter: 'CC-701',
      monthlyBudget: 120000,
      managerName: 'Camila Borges',
      color: '#ec4899',
    });
    component.saveDepartment();

    expect(settingsService.organization().departments.length).toBe(
      initialCount + 1,
    );
    expect(component.isAddingDepartment()).toBe(false);
  });

  it('deve registrar um novo funcionário na organização', () => {
    const initialCount = settingsService.organization().employees.length;
    component.openNewEmployeeForm();
    component.employeeForm.setValue({
      employeeCode: 'STP-0999',
      fullName: 'Bruno Martins',
      email: 'bruno.martins@startop.com.br',
      phone: '+55 (11) 99999-1111',
      jobTitle: 'Coordenador de Compras',
      role: 'GERENTE',
      departmentId: 'dep-fin',
      approvalLimit: 40000,
      status: 'ATIVO',
    });
    component.saveEmployee();

    expect(settingsService.organization().employees.length).toBe(
      initialCount + 1,
    );
    expect(component.isEmployeeFormOpen()).toBe(false);
  });

  describe('#114: sem expor senha nem acesso à conta de terceiros', () => {
    const elemento = () => fixture.nativeElement as HTMLElement;

    it('a área de funcionários continua levando para Delegações', () => {
      component.selectTab('employees');
      fixture.detectChanges();

      const link = elemento().querySelector('a[href="/configuracoes/delegacoes"]');
      expect(link?.textContent).toContain('Controlar Acessos em Delegações');
    });

    it('não preenche a senha atual ao editar e mostra o campo mascarado', () => {
      const emp = settingsService.organization().employees[0];
      settingsService.updateEmployee(emp.id, { password: 'senha-secreta-1' });
      component.selectTab('employees');
      component.editEmployee(settingsService.organization().employees[0]);
      fixture.detectChanges();

      expect(component.employeePassword()).toBe('');
      const campo = elemento().querySelector<HTMLInputElement>('#empPass');
      expect(campo?.type).toBe('password');
      expect(elemento().innerHTML).not.toContain('senha-secreta-1');
    });

    it('mantém a senha atual quando o campo fica em branco na edição', () => {
      const emp = settingsService.organization().employees[0];
      settingsService.updateEmployee(emp.id, { password: 'senha-secreta-1' });
      component.editEmployee(settingsService.organization().employees[0]);
      component.saveEmployee();

      const salvo = settingsService.organization().employees.find((e) => e.id === emp.id);
      expect(salvo?.password).toBe('senha-secreta-1');
    });

    it('troca a senha quando uma nova é informada na edição', () => {
      const emp = settingsService.organization().employees[0];
      component.editEmployee(emp);
      component.employeePassword.set('nova-senha-2');
      component.saveEmployee();

      const salvo = settingsService.organization().employees.find((e) => e.id === emp.id);
      expect(salvo?.password).toBe('nova-senha-2');
    });
  });

  it('deve atualizar as políticas de governança do projeto', () => {
    component.policiesForm.patchValue({
      autoApproveBelow: 1000,
      defaultSlaHours: 12,
    });
    component.savePolicies();

    expect(settingsService.organization().policies.autoApproveBelow).toBe(1000);
    expect(settingsService.organization().policies.defaultSlaHours).toBe(12);
  });
});
