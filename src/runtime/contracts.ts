import { z } from 'zod';
import { AccessScope, ActionRequest, ExecutionBudget } from '../governance/contracts.js';
import { Id } from '../office/contracts.js';
export const Content = z.object({ text: z.string().trim().min(1).max(12000) }).strict();
export const Review = z.object({ accepted: z.boolean(), explanation: z.string().trim().min(1).max(4000) }).strict();
export const StartRequest = z.object({ brief: z.string().trim().min(1).max(8000), approverHumanId: Id }).strict();
export const Run = z.object({
 id: z.uuid(), scope: AccessScope, createdByHumanId: Id, approverHumanId: Id, brief: z.string(),
 status: z.enum(['queued', 'generating', 'awaiting_review', 'reviewing', 'awaiting_approval', 'approved', 'dispatching', 'outcome_unknown', 'completed', 'failed']),
 version: z.number().int().nonnegative(), createdAt: z.string(), deadline: z.string(),
 budget: ExecutionBudget, reservedCostMicros: z.number().nonnegative(), modelCalls: z.number(), toolCalls: z.number(),
 leaseUntil: z.string().nullable(), activeAttemptId: z.uuid().nullable(), action: ActionRequest.nullable(),
 review: Review.nullable(),
}).strict();
export type Run = z.infer<typeof Run>;
export const Defaults = {
 currency: 'USD', maxCostMicros: 100000, maxDurationMs: 900000,
 maxModelCalls: 6, maxToolCalls: 3, maxDelegationDepth: 1,
};
export const workflowResource = (scope: AccessScope) => ({ type: 'workflow', id: 'content-pilot', scope });
export const worker = { kind: 'agent' as const, id: 'content' };
export const reviewer = { kind: 'agent' as const, id: 'review' };
export const orchestrator = { kind: 'service' as const, id: 'content-orchestrator' };
export const executor = { kind: 'service' as const, id: 'delivery-executor' };
export class RuntimeError extends Error {
 constructor(public readonly status: number, message: string) { super(message); }
}
