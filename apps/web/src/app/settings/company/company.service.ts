import { Injectable, signal } from '@angular/core';
import { Company } from './company.model';

/**
 * Fonte única dos dados da empresa. Como é um signal, a sidebar principal
 * pode ler `company().departments` e se moldar à empresa cadastrada.
 */
@Injectable({ providedIn: 'root' })
export class CompanyService {
  // TODO: carregar via API NestJS (GET /company) -> Firestore "companies/{id}"
  readonly company = signal<Company>({
    cnpj: '00.000.000/0001-00',
    legalName: 'Startop LTDA',
    tradeName: 'Startop',
    address: {
      zip: '70000-000',
      street: 'SCS Quadra 1',
      number: '10',
      complement: 'Sala 201',
      district: 'Asa Sul',
      city: 'Brasília',
      state: 'DF',
    },
    departments: [
      { id: 'dep-1', name: 'Financeiro' },
      { id: 'dep-2', name: 'Controladoria' },
      { id: 'dep-3', name: 'Operações' },
    ],
  });

  update(next: Company): void {
    // TODO: PUT /company e só atualizar o signal após a resposta da API
    this.company.set(next);
  }
}
