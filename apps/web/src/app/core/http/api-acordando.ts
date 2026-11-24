import { HttpErrorResponse } from '@angular/common/http';
import { MonoTypeOperatorFunction, TimeoutError, retry, throwError, timeout, timer } from 'rxjs';

/**
 * O plano gratuito do Render desliga a API ociosa e leva cerca de 1 minuto para acordá-la.
 * Estes valores dão tempo para o primeiro acesso do dia sem transformar a espera em erro.
 */
export const TEMPO_LIMITE_DA_API_MS = 90_000;
export const TENTATIVAS_EXTRAS_DA_API = 2;
export const INTERVALO_ENTRE_TENTATIVAS_MS = 5_000;
/** A partir deste tempo sem resposta a tela avisa que a API pode estar iniciando. */
export const LIMIAR_DE_DEMORA_MS = 3_000;

/** Status devolvidos pelo proxy do Render enquanto o contêiner da API ainda está subindo. */
const STATUS_DE_API_ACORDANDO = new Set([0, 502, 503, 504]);

/** Só vale tentar de novo quando a falha é de disponibilidade, não de regra de negócio (4xx/500). */
export function falhaDeApiAcordando(erro: unknown): boolean {
  if (erro instanceof TimeoutError) return true;
  return erro instanceof HttpErrorResponse && STATUS_DE_API_ACORDANDO.has(erro.status);
}

/** Aplica tempo limite por tentativa e repete a chamada enquanto a API acorda. */
export function aguardarApiAcordar<T>(): MonoTypeOperatorFunction<T> {
  return (origem) =>
    origem.pipe(
      timeout(TEMPO_LIMITE_DA_API_MS),
      retry({
        count: TENTATIVAS_EXTRAS_DA_API,
        delay: (erro: unknown) =>
          falhaDeApiAcordando(erro) ? timer(INTERVALO_ENTRE_TENTATIVAS_MS) : throwError(() => erro),
      }),
    );
}
