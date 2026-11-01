export interface Department {
  id: string;
  name: string;
}

export interface CompanyAddress {
  zip: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
}

export interface Company {
  cnpj: string;
  legalName: string;
  tradeName: string;
  address: CompanyAddress;
  departments: Department[];
}
