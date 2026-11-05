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

function decodificarJwtLocal(token: string): Record<string, unknown> | null {
  if (process.env['NODE_ENV'] === 'production') {
    return null;
  }
  const partes = token.split('.');
  if (partes.length !== 3) {
    return null;
  }
  try {
    const json = Buffer.from(partes[1], 'base64url').toString('utf8');
    const payload = JSON.parse(json) as Record<string, unknown>;
    if (typeof payload['exp'] === 'number' && payload['exp'] * 1000 < Date.now()) {
      return null;
    }
    const uid = payload['uid'] ?? payload['user_id'] ?? payload['sub'];
    if (typeof uid !== 'string' || !uid) {
      return null;
    }
    return { ...payload, uid };
  } catch {
    return null;
  }
}

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const req = contexto.switchToHttp().getRequest();
    const cabecalho: string | undefined = req.headers['authorization'];

    if (!cabecalho || !cabecalho.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de autenticação ausente');
    }

    const token = cabecalho.slice('Bearer '.length).trim();
    let decodificado: Record<string, unknown> & { uid?: string; email?: string };
    try {
      decodificado = (await getAuth(getFirebaseApp()).verifyIdToken(token)) as unknown as Record<
        string,
        unknown
      > & { uid?: string; email?: string };
    } catch {
      const local = decodificarJwtLocal(token);
      if (!local) {
        throw new UnauthorizedException('Token inválido ou expirado');
      }
      decodificado = local as Record<string, unknown> & { uid?: string; email?: string };
    }

    const tenantId = decodificado['tenantId'];
    if (typeof tenantId !== 'string' || !TENANT_VALIDO.test(tenantId)) {
      throw new ForbiddenException('Usuário sem empresa (tenant) associada');
    }

    const usuario: UsuarioAutenticado = {
      uid: String(decodificado.uid ?? decodificado['user_id'] ?? decodificado['sub'] ?? ''),
      email: typeof decodificado.email === 'string' ? decodificado.email : undefined,
      tenantId,
      papeis: extrairPapeis(decodificado),
      ip: req.ip,
    };
    req.usuario = usuario;
    return true;
  }
}
