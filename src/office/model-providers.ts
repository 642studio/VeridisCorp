import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogle } from '@langchain/google/node';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { z } from 'zod';
import type { ResolvedProfile, ModelSelection } from './models.js';

export type StructuredRequest = {
  selection: ModelSelection;
  profile: ResolvedProfile;
  schema: z.ZodObject;
  schemaName: string;
  messages: { role: 'system' | 'user'; content: string }[];
};
export type StructuredInvoker = (request: StructuredRequest) => Promise<unknown>;

export function createProfileModel(profile: ResolvedProfile, env: NodeJS.ProcessEnv): BaseChatModel {
  const apiKey = env[profile.apiKeyEnv];
  if (!apiKey?.trim()) throw new Error(`Falta la credencial ${profile.apiKeyEnv} para ${profile.provider}`);
  const common = { model: profile.model, apiKey, maxRetries: profile.maxRetries };
  switch (profile.provider) {
    case 'openai': return new ChatOpenAI({
      ...common, maxTokens: profile.maxOutputTokens,
      configuration: profile.baseURL ? { baseURL: profile.baseURL } : undefined,
    });
    case 'anthropic': return new ChatAnthropic({ ...common, maxTokens: profile.maxOutputTokens });
    case 'google': return new ChatGoogle({ ...common, platformType: 'gai', maxOutputTokens: profile.maxOutputTokens });
  }
}

export function createStructuredInvoker(env: NodeJS.ProcessEnv = process.env): StructuredInvoker {
  const clients = new Map<string, BaseChatModel>();
  return async ({ selection, profile, schema, schemaName, messages }) => {
    const cacheKey = JSON.stringify(profile);
    let client = clients.get(cacheKey);
    if (!client) {
      client = createProfileModel(profile, env);
      clients.set(cacheKey, client);
    }
    return client.withStructuredOutput(schema, { name: schemaName }).invoke(messages, {
      signal: AbortSignal.timeout(profile.timeoutMs),
    });
  };
}
