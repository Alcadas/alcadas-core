export interface UserProfile {
  fullName: string;
  email: string;
  phone: string;
  company: string;
  cnpj: string;
  jobTitle: string;
  department: string;
  employeeId: string;
  roles: string[];
  approvalLimit: number;
  costCenters: string[];
  activeDelegation: string | null;
  lastAccess: Date;
  isActive: boolean;
}
