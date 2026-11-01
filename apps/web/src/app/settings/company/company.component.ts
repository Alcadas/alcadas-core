import { Component, inject, signal } from '@angular/core';
import { FormControl, FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { cnpjValidator, formatCep, formatCnpj } from '../validators/cnpj.validator';
import { CompanyService } from './company.service';
import { Department } from './company.model';

@Component({
  selector: 'app-company',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './company.component.html',
  styleUrl: './company.component.scss',
})
export class CompanyComponent {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(CompanyService);

  readonly saved = signal(false);
  readonly newDepartment = new FormControl('', { nonNullable: true });
  readonly duplicateDepartment = signal(false);

  readonly departments = new FormArray<ReturnType<CompanyComponent['departmentGroup']>>([]);

  readonly form = this.fb.nonNullable.group({
    cnpj: ['', [Validators.required, cnpjValidator]],
    legalName: ['', Validators.required],
    tradeName: [''],
    address: this.fb.nonNullable.group({
      zip: ['', [Validators.required, Validators.pattern(/^\d{5}-\d{3}$/)]],
      street: ['', Validators.required],
      number: ['', Validators.required],
      complement: [''],
      district: [''],
      city: ['', Validators.required],
      state: ['', [Validators.required, Validators.pattern(/^[A-Za-z]{2}$/)]],
    }),
    departments: this.departments,
  });

  constructor() {
    const { departments, ...rest } = this.service.company();
    this.form.patchValue(rest);
    departments.forEach((d) => this.departments.push(this.departmentGroup(d)));
  }

  private departmentGroup(d: Department) {
    return this.fb.nonNullable.group({
      id: [d.id],
      name: [d.name, Validators.required],
    });
  }

  maskCnpj(): void {
    const ctrl = this.form.controls.cnpj;
    ctrl.setValue(formatCnpj(ctrl.value), { emitEvent: false });
  }

  maskCep(): void {
    const ctrl = this.form.controls.address.controls.zip;
    ctrl.setValue(formatCep(ctrl.value), { emitEvent: false });
  }

  addDepartment(): void {
    const name = this.newDepartment.value.trim();
    if (!name) return;

    const exists = this.departments.controls.some(
      (g) => g.controls.name.value.trim().toLowerCase() === name.toLowerCase(),
    );
    this.duplicateDepartment.set(exists);
    if (exists) return;

    this.departments.push(this.departmentGroup({ id: crypto.randomUUID(), name }));
    this.departments.markAsDirty();
    this.newDepartment.reset();
  }

  removeDepartment(index: number): void {
    // TODO: bloquear a remoção se houver solicitações/alçadas vinculadas ao departamento
    this.departments.removeAt(index);
    this.departments.markAsDirty();
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.saved.set(false);
      return;
    }
    this.service.update(this.form.getRawValue());
    this.form.markAsPristine();
    this.saved.set(true);
  }

  discard(): void {
    const { departments, ...rest } = this.service.company();
    this.departments.clear();
    departments.forEach((d) => this.departments.push(this.departmentGroup(d)));
    this.form.patchValue(rest);
    this.form.markAsPristine();
    this.saved.set(false);
  }

  invalid(ctrl: { touched: boolean; invalid: boolean }): boolean {
    return ctrl.touched && ctrl.invalid;
  }
}
