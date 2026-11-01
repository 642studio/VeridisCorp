import { readFileSync } from 'node:fs';
import { z } from 'zod';

// Precio por millón de tokens, en micros de la moneda declarada (mismo entero que costMicros en
// governance/contracts.ts: UsageRecord.costMicros, ExecutionBudget.maxCostMicros). El operador
// copia esta lista desde la página de precios vigente del proveedor — igual que
// config/models.example.json nunca adivina el identificador de un modelo, esta lista nunca
// adivina un precio. Sin entrada para un modelo, priceTokens() devuelve costStatus:'unknown',
// jamás un número inventado.
const PriceEntry = z.object({
  inputMicrosPerMillionTokens: z.number().int().nonnegative().safe(),
  outputMicrosPerMillionTokens: z.number().int().nonnegative().safe(),
}).strict();
export const PriceList = z.object({
  version: z.literal(1),
  currency: z.string().regex(/^[A-Z]{3}$/).default('USD'),
  // Clave "<provider>:<model>" — el mismo par que ya resuelve ModelRouter.select() en
  // ModelSelection.provider/.model, así que no hace falta mantener otro identificador de perfil.
  prices: z.record(z.string(), PriceEntry),
}).strict();
export type PriceList = z.infer<typeof PriceList>;

export function loadPriceList(env: NodeJS.ProcessEnv = process.env): PriceList | null {
  if (!env.VERIDIS_PRICES_FILE) return null;
  return PriceList.parse(JSON.parse(readFileSync(env.VERIDIS_PRICES_FILE, 'utf8')));
}

export interface TokenUsage {
  inputTokens: number | null;
  outputTokens: number | null;
}
export interface PriceResult {
  costMicros: number | null;
  costStatus: 'estimated' | 'unknown';
  currency: string;
}

// Puro: nunca llama red ni Postgres, y nunca redondea a favor de ocultar que falta un dato.
// costStatus queda 'unknown' (costMicros null) si falta la lista de precios, el par
// provider:model no está en ella, o no se conocen ambos conteos de tokens — nunca se estima con
// un solo lado conocido ni se asume cero para el que falta.
export function priceTokens(priceList: PriceList | null, provider: string, model: string, usage: TokenUsage): PriceResult {
  const currency = priceList?.currency ?? 'USD';
  const entry = priceList?.prices[`${provider}:${model}`];
  if (!entry || usage.inputTokens == null || usage.outputTokens == null) {
    return { costMicros: null, costStatus: 'unknown', currency };
  }
  const costMicros = Math.round(
    (usage.inputTokens / 1_000_000) * entry.inputMicrosPerMillionTokens
    + (usage.outputTokens / 1_000_000) * entry.outputMicrosPerMillionTokens,
  );
  return { costMicros, costStatus: 'estimated', currency };
}
