import type { Budget } from '../api/types';

function microsToDisplay(micros: number, currency: string): string {
  return `${(micros / 1_000_000).toFixed(4)} ${currency}`;
}

export function BudgetGauge({
  reservedCostMicros, modelCalls, toolCalls, budget,
}: { reservedCostMicros: number; modelCalls: number; toolCalls: number; budget: Budget }) {
  const costRatio = budget.maxCostMicros > 0 ? Math.min(1, reservedCostMicros / budget.maxCostMicros) : 0;
  return (
    <div className="budget-gauge">
      <div className="budget-gauge__row">
        <span>Costo reservado</span>
        <span>{microsToDisplay(reservedCostMicros, budget.currency)} / {microsToDisplay(budget.maxCostMicros, budget.currency)}</span>
      </div>
      <div className="budget-gauge__bar"><div className="budget-gauge__fill" style={{ width: `${costRatio * 100}%` }} /></div>
      <div className="budget-gauge__row budget-gauge__row--small">
        <span>Llamadas a modelo: {modelCalls}/{budget.maxModelCalls}</span>
        <span>Llamadas a herramienta: {toolCalls}/{budget.maxToolCalls}</span>
      </div>
    </div>
  );
}
