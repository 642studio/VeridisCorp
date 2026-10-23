import { z } from 'zod';
import { ExternalOperation } from './enterprise-contracts.js';

export type RecoveryDecision =
  | { next: 'keep_confirmed'; externalReference: string }
  | { next: 'query_provider'; reason: string }
  | { next: 'retry_same_key'; reason: string }
  | { next: 'manual_reconciliation'; reason: string };
const Observation = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('not_checked') }).strict(),
  z.object({ kind: z.literal('confirmed'), externalReference: z.string().trim().min(1) }).strict(),
  z.object({ kind: z.literal('unknown') }).strict(),
]);
type Observation = z.infer<typeof Observation>;

/** Decide cómo recuperar una operación; no llama al proveedor ni vuelve a ejecutarla. */
export function planExternalRecovery(input: z.infer<typeof ExternalOperation>, observationInput: Observation): RecoveryDecision {
  const operation = ExternalOperation.parse(input);
  const observation = Observation.parse(observationInput);
  if (!['dispatching', 'outcome_unknown', 'confirmed'].includes(operation.status)) throw new Error('La operación no está en recuperación de resultado');
  if (operation.status === 'confirmed' && operation.externalReference) return { next: 'keep_confirmed', externalReference: operation.externalReference };
  if (observation.kind === 'confirmed') return { next: 'keep_confirmed', externalReference: observation.externalReference };
  if (operation.recovery.strategy === 'query_before_retry' && observation.kind === 'not_checked') {
    return { next: 'query_provider', reason: 'Consultar por clave o referencia antes de cualquier repetición' };
  }
  if (operation.recovery.strategy === 'provider_idempotency') {
    return { next: 'retry_same_key', reason: 'Solo mediante la garantía vigente del conector y conservando clave y contenido' };
  }
  return { next: 'manual_reconciliation', reason: 'El resultado no está confirmado y no hay garantía para repetir' };
}
