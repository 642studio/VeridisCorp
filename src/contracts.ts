import { z } from 'zod';

export const AgentId = z.enum(['operations', 'content', 'development']);
export type AgentId = z.infer<typeof AgentId>;
export const Task = z.object({
  agent: AgentId,
  instruction: z.string().min(1).max(4000),
});
export const Plan = z.object({ tasks: z.array(Task).min(1).max(6) });
export type Task = z.infer<typeof Task>;
export type Plan = z.infer<typeof Plan>;
export type Result = { agent: AgentId; instruction: string; output: string };

// Los adaptadores de modelos no conocen PostgreSQL ni el transporte de entrada.
export interface Intelligence {
  plan(request: string): Promise<Plan>;
  execute(request: string, task: Task, previous: Result[]): Promise<string>;
  summarize(request: string, results: Result[]): Promise<string>;
}

export const agents: Record<AgentId, { name: string; scope: string }> = {
  operations: {
    name: 'Veridis_AgenteOperativo',
    scope: 'Organización de tareas, clientes y procesos de 642 Studio. Preparar propuestas compatibles con ClickUp.',
  },
  content: {
    name: 'Veridis_AgenteContenido',
    scope: 'Estrategia, calendarios y borradores de contenido por marca. Solicitar datos de marca si faltan.',
  },
  development: {
    name: 'Veridis_AgenteDesarrollo',
    scope: 'Arquitectura, código propuesto, revisión y documentación de software. Declarar supuestos y verificaciones pendientes.',
  },
};
