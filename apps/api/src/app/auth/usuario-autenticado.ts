import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface UsuarioAutenticado {
  uid: string;
  email?: string;
  tenantId: string;
  papeis: string[];
  costCenterId?: string;
  departmentId?: string;
  ip?: string;
}

export const UsuarioAtual = createParamDecorator(
  (_dados: unknown, contexto: ExecutionContext): UsuarioAutenticado => {
    return contexto.switchToHttp().getRequest().usuario;
  },
);