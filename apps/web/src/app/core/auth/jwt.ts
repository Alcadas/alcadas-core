/**
 * Lê as claims de um JWT sem validar a assinatura. Serve só para exibir dados do usuário
 * na interface; quem valida o token é a API (FirebaseAuthGuard / JwtAuthGuard).
 */
export function lerClaimsDoJwt(token: string): Record<string, unknown> | null {
  const partes = token.split('.');
  if (partes.length !== 3) {
    return null;
  }
  try {
    const base64 = partes[1].replace(/-/g, '+').replace(/_/g, '/');
    const preenchido = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = decodeURIComponent(
      Array.from(atob(preenchido), (c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''),
    );
    const claims: unknown = JSON.parse(json);
    return claims && typeof claims === 'object' ? (claims as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
