import type { ModelCallRecord, ModelSelection } from './models.js';
import type { PriceList } from './prices.js';

// Cuántas llamadas recientes con precio se miran para proyectar la siguiente. Se toma la MÁS
// cara de ellas, no el promedio: el expediente alterna llamadas baratas (un dispatch del
// coordinador) con caras (un especialista con contexto largo), y un promedio subestimaría
// justo la llamada que rebasa el tope.
const PROJECTION_WINDOW = 5;
const WARNING_RATIO = 0.8;
const CRITICAL_RATIO = 0.9;

export type BudgetLevel = 'none' | 'ok' | 'warning' | 'critical' | 'exceeded';

export interface BudgetStatus {
  maxCostMicros: number | null;
  spentMicros: number;
  // Llamadas sin costo conocido (sin conteo de tokens o sin precio configurado): spentMicros
  // las excluye, así que con unpricedCalls > 0 el gasto real es MAYOR que spentMicros.
  unpricedCalls: number;
  projectedNextMicros: number | null;
  level: BudgetLevel;
}

export function budgetStatus(modelCalls: ModelCallRecord[], maxCostMicros: number | null | undefined): BudgetStatus {
  const priced = modelCalls.filter((c) => c.costStatus === 'estimated' && c.costMicros !== null);
  const spentMicros = priced.reduce((sum, c) => sum + c.costMicros!, 0);
  const recent = priced.slice(-PROJECTION_WINDOW);
  const projectedNextMicros = recent.length ? Math.max(...recent.map((c) => c.costMicros!)) : null;
  const max = maxCostMicros ?? null;
  const ratio = max ? spentMicros / max : 0;
  const level: BudgetLevel = max === null ? 'none'
    : ratio >= 1 ? 'exceeded' : ratio >= CRITICAL_RATIO ? 'critical' : ratio >= WARNING_RATIO ? 'warning' : 'ok';
  return { maxCostMicros: max, spentMicros, unpricedCalls: modelCalls.length - priced.length, projectedNextMicros, level };
}

// Se consulta ANTES de cada llamada al modelo, no después: devuelve el motivo para pausar el
// expediente, o null si la llamada puede seguir. Es una proyección, no una garantía — una
// llamada puede salir más cara que todas las anteriores, y los reintentos internos de un mismo
// nodo (withRetries, hasta 3) no se vuelven a consultar entre sí.
export function budgetBlockReason(
  modelCalls: ModelCallRecord[], maxCostMicros: number | null | undefined,
  priceList: PriceList | null, next: ModelSelection | undefined,
): string | null {
  if (maxCostMicros == null) return null;
  // Un presupuesto que no se puede medir no es un presupuesto: si el modelo de la próxima
  // llamada no tiene precio configurado, su costo quedaría fuera de spentMicros para siempre.
  if (next && !priceList?.prices[`${next.provider}:${next.model}`]) {
    return `Presupuesto de ${formatUsd(maxCostMicros)} configurado, pero sin precio para ${next.provider}:${next.model} en VERIDIS_PRICES_FILE: el gasto no se puede verificar.`;
  }
  const status = budgetStatus(modelCalls, maxCostMicros);
  if (status.spentMicros >= maxCostMicros) {
    return `Presupuesto agotado: ${formatUsd(status.spentMicros)} gastados de ${formatUsd(maxCostMicros)}.`;
  }
  if (status.projectedNextMicros !== null && status.spentMicros + status.projectedNextMicros > maxCostMicros) {
    return `Presupuesto proyectado: ${formatUsd(status.spentMicros)} gastados de ${formatUsd(maxCostMicros)}; la próxima llamada `
      + `(estimada en ${formatUsd(status.projectedNextMicros)}, la más cara de las últimas ${PROJECTION_WINDOW}) lo superaría.`;
  }
  return null;
}

// Sin sufijo de moneda a propósito: costMicros está en la moneda que declare VERIDIS_PRICES_FILE
// (USD por defecto), y este módulo no la conoce.
function formatUsd(micros: number): string {
  return `$${(micros / 1_000_000).toFixed(4)}`;
}
