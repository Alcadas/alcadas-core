import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { UserProfile } from './user-profile.model';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  user!: UserProfile;
  isEditing = false;

  // Only these fields can be edited by the user (RBAC: the rest is managed by admins)
  readonly form = this.fb.nonNullable.group({
    fullName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
  });

  ngOnInit(): void {
    // TODO: replace with real data (Firebase Auth uid -> Firestore "users/{uid}" via NestJS API)
    this.user = {
      fullName: 'Julia Campos Santana',
      email: 'julia.santana@startop.com.br',
      phone: '+55 61 9350-0062',
      company: 'Startop LTDA',
      cnpj: '00.000.000/0001-00',
      jobTitle: 'Gerente Financeira',
      department: 'Financeiro',
      employeeId: 'STP-0142',
      roles: ['Gerente', 'Diretor'],
      approvalLimit: 50000,
      costCenters: ['Clínicas', 'Obras'],
      activeDelegation: null,
      lastAccess: new Date(),
      isActive: true,
    };
  }

  get initials(): string {
    return this.user.fullName
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  get formattedLimit(): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(this.user.approvalLimit);
  }

  get formattedLastAccess(): string {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(this.user.lastAccess);
  }

  startEdit(): void {
    this.form.setValue({
      fullName: this.user.fullName,
      email: this.user.email,
      phone: this.user.phone,
    });
    this.isEditing = true;
  }

  cancelEdit(): void {
    this.isEditing = false;
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    // TODO: call the API (PATCH /users/me) before updating the local state
    this.user = { ...this.user, ...this.form.getRawValue() };
    this.isEditing = false;
  }

  logout(): void {
    // TODO: call Firebase Auth signOut()
  }
}
