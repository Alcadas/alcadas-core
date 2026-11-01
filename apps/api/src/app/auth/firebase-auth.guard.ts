import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { getAuth } from 'firebase-admin/auth';
import { getFirebaseApp } from '../firebase/firebase-app';
import { UsuarioAutenticado } from './usuario-autenticado';

const TENANT_VALIDO = /^[A-Za-z0-9_-]+$/;

function extrairPapeis(decodificado: Record<string, unknown>): string[] {
  return [decodificado['roles'], decodificado['papel'], decodificado['role']]
    .flat()
    .filter((p): p is string => typeof p === 'string');
}

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const req = contexto.switchToHttp().getRequest();
    const cabecalho: string | undefined = req.headers['authorization'];

    if (!cabecalho || !cabecalho.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de autenticação ausente');
    }

    let decodificado;
    try {
      decodificado = await getAuth(getFirebaseApp()).verifyIdToken(cabecalho.slice('Bearer '.length));
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado');
    }

    const tenantId = decodificado['tenantId'];
    if (typeof tenantId !== 'string' || !TENANT_VALIDO.test(tenantId)) {
      throw new ForbiddenException('Usuário sem empresa (tenant) associada');
    }

    const usuario: UsuarioAutenticado = {
      uid: decodificado.uid,
      email: decodificado.email,
      tenantId,
      papeis: extrairPapeis(decodificado),
      ip: req.ip,
    };
    req.usuario = usuario;
    return true;
  }
}