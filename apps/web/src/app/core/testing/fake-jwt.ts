/**
 * Monta um JWT sem assinatura para testes (o frontend só lê as claims).
 * Usado apenas pelas specs.
 */
export function criarJwtDeTeste(claims: Record<string, unknown>): string {
  const binario = (texto: string) =>
    encodeURIComponent(texto).replace(/%([0-9A-F]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
  const base64Url = (texto: string) =>
    btoa(binario(texto)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${base64Url('{"alg":"none","typ":"JWT"}')}.${base64Url(JSON.stringify(claims))}.assinatura`;
}
