import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { Id } from './contracts.js';

export const ModelStage = z.enum(['coordinate', 'execute', 'review']);
export type ModelStage = z.infer<typeof ModelStage>;
const EnvName = z.string().regex(/^[A-Z][A-Z0-9_]*$/);
const ProfileFields = {
  provider: z.enum(['openai', 'anthropic', 'google']),
  apiKeyEnv: EnvName,
  baseURL: z.url().refine((value) => {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash;
  }, 'La URL debe ser HTTP(S), sin credenciales, query ni fragmento').optional(),
  maxOutputTokens: z.number().int().min(64).max(64000).default(4000),
  timeoutMs: z.number().int().min(1000).max(300000).default(60000),
  maxRetries: z.number().int().min(0).max(3).default(2),
  structuredOutputMethod: z.enum(['jsonMode', 'jsonSchema', 'functionCalling']).optional(),
  thinkingMode: z.enum(['enabled', 'disabled']).optional(),
  reasoningEffort: z.enum(['none', 'low', 'medium', 'high']).optional(),
};
const profileRefinement = (profile: { provider: string; baseURL?: string; structuredOutputMethod?: string; thinkingMode?: string; reasoningEffort?: string }) =>
  ((!profile.baseURL && !profile.structuredOutputMethod && !profile.thinkingMode && !profile.reasoningEffort) || profile.provider === 'openai')
  && (!profile.thinkingMode || Boolean(profile.baseURL));
const ConfigProfile = z.object({
  ...ProfileFields,
  model: z.string().trim().min(1).optional(),
  modelEnv: EnvName.optional(),
}).strict().refine((p) => Boolean(p.model) !== Boolean(p.modelEnv), 'Define model o modelEnv, exclusivamente uno')
  .refine(profileRefinement, 'baseURL solo se admite con el adaptador openai');
export const ResolvedProfile = z.object({ ...ProfileFields, model: z.string().trim().min(1) }).strict()
  .refine(profileRefinement, 'baseURL solo se admite con el adaptador openai');
export type ResolvedProfile = z.infer<typeof ResolvedProfile>;
const StageProfiles = z.object({ coordinate: Id.optional(), execute: Id.optional(), review: Id.optional() }).strict();
export const ModelPolicy = z.object({
  version: z.literal(1),
  profiles: z.record(Id, ConfigProfile),
  defaultProfile: Id,
  stages: StageProfiles.default({}),
  agents: z.record(Id, StageProfiles).default({}),
  rules: z.array(z.object({ stage: ModelStage, agentId: Id.optional(), capability: Id, profile: Id }).strict()).default([]),
}).strict();
export type ModelPolicyInput = z.input<typeof ModelPolicy>;
export type ModelRequest = { stage: ModelStage; agentId: string; capability: string };
export type ModelSelection = ModelRequest & {
  profileId: string; provider: ResolvedProfile['provider']; model: string;
};

export class ModelRouter {
  private readonly policy: z.output<typeof ModelPolicy>;
  private readonly profiles: Record<string, ResolvedProfile>;
  readonly fingerprint: string;

  constructor(input: ModelPolicyInput, env: NodeJS.ProcessEnv = process.env) {
    this.policy = ModelPolicy.parse(input);
    this.profiles = Object.fromEntries(Object.entries(this.policy.profiles).map(([id, profile]) => {
      const { modelEnv, model, ...settings } = profile;
      const resolved = model || (modelEnv ? env[modelEnv] : undefined);
      if (!resolved?.trim()) throw new Error(`Falta el modelo del perfil ${id}${modelEnv ? ` (${modelEnv})` : ''}`);
      return [id, ResolvedProfile.parse({ ...settings, model: resolved })];
    }));
    const references = [this.policy.defaultProfile, ...Object.values(this.policy.stages),
      ...Object.values(this.policy.agents).flatMap((stages) => Object.values(stages)), ...this.policy.rules.map((r) => r.profile)];
    for (const profile of references) {
      if (profile && !this.profiles[profile]) throw new Error('Perfil de modelo inexistente: ' + profile);
    }
    const selectors = this.policy.rules.map(({ stage, agentId, capability }) => JSON.stringify([stage, agentId || null, capability]));
    if (new Set(selectors).size !== selectors.length) throw new Error('Reglas de modelo duplicadas');
    // Política pública resuelta: nunca contiene valores de credenciales.
    this.fingerprint = createHash('sha256').update(JSON.stringify(this.snapshot())).digest('hex');
  }

  snapshot() {
    return structuredClone({ ...this.policy, profiles: this.profiles });
  }

  select(request: ModelRequest): ModelSelection {
    const rule = this.policy.rules.find((r) => r.stage === request.stage && r.agentId === request.agentId && r.capability === request.capability)
      || this.policy.rules.find((r) => r.stage === request.stage && !r.agentId && r.capability === request.capability);
    const profileId = rule?.profile || this.policy.agents[request.agentId]?.[request.stage]
      || this.policy.stages[request.stage] || this.policy.defaultProfile;
    const profile = this.profile(profileId);
    return { ...request, profileId, provider: profile.provider, model: profile.model };
  }

  profile(profileId: string): ResolvedProfile {
    const profile = this.profiles[profileId];
    if (!profile) throw new Error('Perfil de modelo inexistente: ' + profileId);
    return structuredClone(profile);
  }
}

export function loadModelRouter(env: NodeJS.ProcessEnv = process.env): ModelRouter {
  if (env.VERIDIS_MODELS_FILE) {
    return new ModelRouter(JSON.parse(readFileSync(env.VERIDIS_MODELS_FILE, 'utf8')), env);
  }
  // Compatibilidad con la configuración anterior para un solo modelo.
  return new ModelRouter({ version: 1, defaultProfile: 'default', profiles: {
    default: { provider: 'openai', modelEnv: 'OPENAI_MODEL', apiKeyEnv: 'OPENAI_API_KEY' },
  } }, env);
}
