// Formato compartido de costo en micros (ver UsageSummary en api/types.ts) — Consumption.tsx y
// AgentDetailPanel.tsx deben mostrar el mismo número para el mismo agente, nunca dos redondeos
// distintos del mismo costMicros.
export function microsToDisplay(micros: number, currency: string): string {
  return `${(micros / 1_000_000).toFixed(4)} ${currency}`;
}
