import { Annotation, StateGraph, START, END, type BaseCheckpointSaver } from '@langchain/langgraph';
import { Plan, type Task, type Result, type Intelligence } from './contracts.js';

export const WorkflowState = Annotation.Root({
  request: Annotation<string>(),
  tasks: Annotation<Task[]>(),
  results: Annotation<Result[]>(),
  cursor: Annotation<number>(),
  answer: Annotation<string>(),
});

export function createWorkflow(intelligence: Intelligence, checkpointer: BaseCheckpointSaver) {
  return new StateGraph(WorkflowState)
    .addNode('supervisor', async (state) => {
      // Validar también adaptadores futuros, no confiar solo en el proveedor.
      const plan = Plan.parse(await intelligence.plan(state.request));
      return { tasks: plan.tasks, cursor: 0, results: [], answer: '' };
    })
    .addNode('specialist', async (state) => {
      const task = state.tasks[state.cursor];
      if (!task) throw new Error('La tarea asignada no existe.');
      const output = await intelligence.execute(state.request, task, state.results);
      if (!output.trim()) throw new Error('El especialista devolvió un resultado vacío.');
      return {
        results: [...state.results, { ...task, output }],
        cursor: state.cursor + 1,
      };
    })
    .addNode('synthesis', async (state) => ({
      answer: await intelligence.summarize(state.request, state.results),
    }))
    .addEdge(START, 'supervisor')
    .addEdge('supervisor', 'specialist')
    .addConditionalEdges('specialist', (state) =>
      state.cursor < state.tasks.length ? 'specialist' : 'synthesis')
    .addEdge('synthesis', END)
    .compile({ checkpointer });
}
