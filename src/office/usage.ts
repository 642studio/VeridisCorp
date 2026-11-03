import { platformOf } from './models.js';

// Una fila por llamada a modelo, venga de un expediente de oficina (ModelCallRecord, volcado por
// src/runtime/office-runtime.ts a veridis_runtime_v1.usage_records) o del chat ASISTENTE
// (veridis_runtime_v1.assistant_messages). profileId es null solo para filas históricas de
// assistant_messages anteriores a que esa tabla empezara a guardarlo.
export interface UsageRow {
  agentId: string;
  profileId: string | null;
  model: string;
  costMicros: number | null;
}

export interface UsageBreakdownEntry {
  key: string;
  costMicros: number;
  pricedCalls: number;
  unpricedCalls: number;
}

export interface UsageSummary {
  currency: string;
  totalCostMicros: number;
  pricedCalls: number;
  unpricedCalls: number;
  byAgent: UsageBreakdownEntry[];
  byPlatform: UsageBreakdownEntry[];
  byApiKeyEnv: UsageBreakdownEntry[];
  byModel: UsageBreakdownEntry[];
}

const UNKNOWN_PROFILE = 'perfil desconocido';

function accumulate(entries: Map<string, UsageBreakdownEntry>, key: string, costMicros: number | null) {
  const entry = entries.get(key) ?? { key, costMicros: 0, pricedCalls: 0, unpricedCalls: 0 };
  if (costMicros === null) entry.unpricedCalls++;
  else { entry.costMicros += costMicros; entry.pricedCalls++; }
  entries.set(key, entry);
}

function sorted(entries: Map<string, UsageBreakdownEntry>): UsageBreakdownEntry[] {
  return [...entries.values()].sort((a, b) => b.costMicros - a.costMicros);
}

// Puro: nunca toca Postgres ni red. resolveProfile envuelve ModelRouter.profile() con try/catch
// del lado de quien llama — un perfil renombrado o borrado de la configuración vigente no debe
// tronar el panel de consumo, solo caer en UNKNOWN_PROFILE (nunca se descarta la fila en silencio).
export function summarizeUsage(
  rows: UsageRow[],
  currency: string,
  resolveProfile: (profileId: string) => { provider: string; apiKeyEnv: string; baseURL?: string } | null,
): UsageSummary {
  const byAgent = new Map<string, UsageBreakdownEntry>();
  const byPlatform = new Map<string, UsageBreakdownEntry>();
  const byApiKeyEnv = new Map<string, UsageBreakdownEntry>();
  const byModel = new Map<string, UsageBreakdownEntry>();
  let totalCostMicros = 0; let pricedCalls = 0; let unpricedCalls = 0;

  for (const row of rows) {
    const resolved = row.profileId ? resolveProfile(row.profileId) : null;
    const platform = resolved ? platformOf(resolved.provider, resolved.baseURL) : UNKNOWN_PROFILE;
    const apiKeyEnv = resolved?.apiKeyEnv ?? UNKNOWN_PROFILE;

    accumulate(byAgent, row.agentId, row.costMicros);
    accumulate(byPlatform, platform, row.costMicros);
    accumulate(byApiKeyEnv, apiKeyEnv, row.costMicros);
    accumulate(byModel, row.model, row.costMicros);

    if (row.costMicros === null) unpricedCalls++;
    else { totalCostMicros += row.costMicros; pricedCalls++; }
  }

  return {
    currency, totalCostMicros, pricedCalls, unpricedCalls,
    byAgent: sorted(byAgent), byPlatform: sorted(byPlatform), byApiKeyEnv: sorted(byApiKeyEnv), byModel: sorted(byModel),
  };
}
