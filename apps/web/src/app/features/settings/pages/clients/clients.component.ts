import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { SettingsService } from '../../services/settings.service';
import {
  EmployeeRoleType,
  SaasClientTenant,
  SaasPlanType,
} from '../../models/organization.model';
import { cnpjValidator, formatCnpj } from '../../validators/cnpj.validator';

@Component({
  selector: 'app-clients-saas',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './clients.component.html',
  styleUrl: './clients.component.scss',
})
export class ClientsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  readonly settingsService = inject(SettingsService);
  readonly authService = inject(AuthService);

  readonly searchQuery = signal('');
  readonly isCreatingTenant = signal(false);
  readonly addingUserToTenantId = signal<string | null>(null);
  readonly feedbackMessage = signal<string | null>(null);
  readonly formError = signal('');

  readonly tenants = this.settingsService.tenants;

  readonly filteredTenants = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return this.tenants();
    return this.tenants().filter(
      (t) =>
        t.organization.tradeName.toLowerCase().includes(q) ||
        t.organization.legalName.toLowerCase().includes(q) ||
        t.organization.cnpj.toLowerCase().includes(q) ||
        t.tenantId.toLowerCase().includes(q) ||
        t.ownerName.toLowerCase().includes(q) ||
        t.ownerEmail.toLowerCase().includes(q),
    );
  });

  readonly totalUsersCount = computed(() =>
    this.tenants().reduce((acc, t) => acc + t.organization.employees.length, 0),
  );

  readonly activeTenantsCount = computed(
    () => this.tenants().filter((t) => t.status === 'ATIVO').length,
  );

  readonly newTenantForm = this.fb.nonNullable.group({
    tradeName: ['', Validators.required],
    legalName: ['', Validators.required],
    cnpj: ['', [Validators.required, cnpjValidator]],
    tenantId: [''],
    corporateEmail: ['', [Validators.required, Validators.email]],
    corporatePhone: ['+55 (11) 3000-0000'],
    plan: ['ENTERPRISE' as SaasPlanType, Validators.required],
    maxUsers: [50, [Validators.required, Validators.min(1)]],
    ownerName: ['', Validators.required],
    ownerEmail: ['', [Validators.required, Validators.email]],
    ownerPassword: ['123456', [Validators.required, Validators.minLength(4)]],
    ownerJobTitle: ['Diretor Executivo (CEO)', Validators.required],
    ownerRole: ['DIRETOR' as EmployeeRoleType, Validators.required],
    ownerApprovalLimit: [500000, [Validators.required, Validators.min(0)]],
  });

  readonly newClientUserForm = this.fb.nonNullable.group({
    fullName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['123456', [Validators.required, Validators.minLength(4)]],
    jobTitle: ['Diretor Financeiro / Gestor', Validators.required],
    role: ['DIRETOR' as EmployeeRoleType, Validators.required],
    approvalLimit: [250000, [Validators.required, Validators.min(0)]],
  });

  openCreateTenant(): void {
    this.addingUserToTenantId.set(null);
    this.formError.set('');
    this.newTenantForm.reset({
      tradeName: '',
      legalName: '',
      cnpj: '',
      tenantId: '',
      corporateEmail: '',
      corporatePhone: '+55 (11) 3000-0000',
      plan: 'ENTERPRISE',
      maxUsers: 50,
      ownerName: '',
      ownerEmail: '',
      ownerPassword: '123456',
      ownerJobTitle: 'Diretor Executivo (CEO)',
      ownerRole: 'DIRETOR',
      ownerApprovalLimit: 500000,
    });
    this.isCreatingTenant.set(true);
  }

  cancelCreateTenant(): void {
    this.isCreatingTenant.set(false);
    this.formError.set('');
  }

  maskCnpj(): void {
    const ctrl = this.newTenantForm.controls.cnpj;
    ctrl.setValue(formatCnpj(ctrl.value), { emitEvent: false });
  }

  autoFillSlug(): void {
    const trade = this.newTenantForm.controls.tradeName.value;
    if (!this.newTenantForm.controls.tenantId.dirty) {
      const slug = trade
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      this.newTenantForm.controls.tenantId.setValue(slug, { emitEvent: false });
    }
  }

  saveNewTenant(): void {
    if (this.newTenantForm.invalid) {
      this.newTenantForm.markAllAsTouched();
      this.formError.set(
        'Preencha todos os dados obrigatórios da empresa e da conta do cliente titular.',
      );
      return;
    }

    const raw = this.newTenantForm.getRawValue();
    const existingAccount = this.settingsService.findAccountByEmail(raw.ownerEmail);
    if (existingAccount) {
      this.formError.set(
        `O e-mail ${raw.ownerEmail} já está vinculado à empresa ${existingAccount.tenant.organization.tradeName}.`,
      );
      return;
    }

    const created = this.settingsService.registerClientTenant(raw);
    this.isCreatingTenant.set(false);
    this.feedbackMessage.set(
      `Empresa "${created.organization.tradeName}" (tenant: ${created.tenantId}) e conta do cliente ${created.ownerEmail} criadas com sucesso!`,
    );
  }

  openAddClientUser(tenantId: string): void {
    this.isCreatingTenant.set(false);
    this.formError.set('');
    this.newClientUserForm.reset({
      fullName: '',
      email: '',
      password: '123456',
      jobTitle: 'Diretor / Gestor da Empresa',
      role: 'DIRETOR',
      approvalLimit: 250000,
    });
    this.addingUserToTenantId.set(tenantId);
  }

  cancelAddClientUser(): void {
    this.addingUserToTenantId.set(null);
    this.formError.set('');
  }

  saveClientUser(tenantId: string): void {
    if (this.newClientUserForm.invalid) {
      this.newClientUserForm.markAllAsTouched();
      this.formError.set('Preencha nome, e-mail válido e senha inicial para o cliente.');
      return;
    }

    const raw = this.newClientUserForm.getRawValue();
    const existing = this.settingsService.findAccountByEmail(raw.email);
    if (existing) {
      this.formError.set(
        `Já existe uma conta cadastrada com o e-mail ${raw.email}.`,
      );
      return;
    }

    const created = this.settingsService.addClientAccountToTenant(tenantId, {
      ...raw,
      isCompanyAdmin: true,
    });
    this.addingUserToTenantId.set(null);
    if (created) {
      this.feedbackMessage.set(
        `Conta de acesso criada para ${created.fullName} (${created.email}) na empresa #${tenantId}.`,
      );
    }
  }

  impersonateAccount(email: string): void {
    const user = this.authService.loginWithTenantAccount(email);
    if (user) {
      const targetRoute = this.settingsService.getFirstAllowedRouteForCurrentUser();
      void this.router.navigate([targetRoute]);
    }
  }

  inspectTenantOrganization(tenant: SaasClientTenant): void {
    this.settingsService.activeTenantId.set(tenant.tenantId);
    void this.router.navigate(['/configuracoes/organizacao']);
  }

  inspectTenantDelegations(tenant: SaasClientTenant): void {
    this.settingsService.activeTenantId.set(tenant.tenantId);
    void this.router.navigate(['/configuracoes/delegacoes']);
  }

  toggleTenantStatus(tenant: SaasClientTenant): void {
    const next = tenant.status === 'ATIVO' ? 'SUSPENSO' : 'ATIVO';
    this.settingsService.updateTenantStatus(tenant.tenantId, next);
    this.feedbackMessage.set(
      `Status da empresa ${tenant.organization.tradeName} alterado para ${next}.`,
    );
  }

  initials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  formatCurrency(val: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  }
}
