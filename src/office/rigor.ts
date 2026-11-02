// Niveles de rigor: un solo ajuste de alcance de proceso para un expediente, no de permisos ni
// herramientas — mismo encuadre que docs/model-routing.md usa para el enrutamiento de modelos.
// Ver docs/office-architecture.md, sección "Niveles de rigor".
export const RIGOR_LEVELS = ['minimal', 'standard', 'full'] as const;
export type Rigor = (typeof RIGOR_LEVELS)[number];

export interface OrderLimitsInput {
  maxTasks: number;
  maxSteps: number;
  maxRevisionsPerTask: number;
  maxCostMicros?: number | null;
}

// Preajustes de los tres límites numéricos de WorkOrder.limits (src/office/contracts.ts). No
// incluyen maxCostMicros: el presupuesto monetario sigue siendo un ajuste explícito aparte
// (ver budget.ts), no algo que el nivel de rigor deba decidir.
const RIGOR_LIMITS: Record<Rigor, Omit<OrderLimitsInput, 'maxCostMicros'>> = {
  minimal: { maxTasks: 10, maxSteps: 200, maxRevisionsPerTask: 2 },
  standard: { maxTasks: 40, maxSteps: 2000, maxRevisionsPerTask: 5 },
  full: { maxTasks: 100, maxSteps: 10000, maxRevisionsPerTask: 20 },
};

// Límites explícitos del llamador siempre ganan sobre el preajuste del nivel — misma prioridad
// "específico antes que general" que ya usa la política de modelos.
export function resolveLimits(rigor: Rigor, explicit?: OrderLimitsInput): OrderLimitsInput {
  if (explicit) return explicit;
  return { ...RIGOR_LIMITS[rigor] };
}
