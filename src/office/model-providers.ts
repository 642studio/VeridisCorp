import { OutputParserException } from '@langchain/core/output_parsers';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogle } from '@langchain/google/node';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { z } from 'zod';
import type { ResolvedProfile, ModelSelection, ModelUsage } from './models.js';

export type StructuredRequest = {
  selection: ModelSelection;
  profile: ResolvedProfile;
  schema: z.ZodObject;
  schemaName: string;
  messages: { role: 'system' | 'user'; content: string }[];
};
export interface StructuredResult {
  // El llamador (intelligence.ts) sigue haciendo schema.parse() sobre esto — con includeRaw:true
  // withStructuredOutput ya no lanza por una salida mal formada, cae a null (ver createStructuredInvoker).
  parsed: unknown;
  usage: ModelUsage;
}
export type StructuredInvoker = (request: StructuredRequest) => Promise<StructuredResult>;

export function createProfileModel(profile: ResolvedProfile, env: NodeJS.ProcessEnv): BaseChatModel {
  const apiKey = env[profile.apiKeyEnv];
  if (!apiKey?.trim()) throw new Error(`Falta la credencial ${profile.apiKeyEnv} para ${profile.provider}`);
  const common = { model: profile.model, apiKey, maxRetries: profile.maxRetries };
  switch (profile.provider) {
    case 'openai': return new ChatOpenAI({
      ...common, maxTokens: profile.maxOutputTokens, timeout: profile.timeoutMs,
      ...(profile.reasoningEffort ? { reasoningEffort: profile.reasoningEffort } : {}),
      ...(profile.thinkingMode ? { modelKwargs: { thinking: { type: profile.thinkingMode } } } : {}),
      configuration: profile.baseURL ? { baseURL: profile.baseURL } : undefined,
    });
    case 'anthropic': return new ChatAnthropic({ ...common, maxTokens: profile.maxOutputTokens });
    case 'google': return new ChatGoogle({ ...common, platformType: 'gai', maxOutputTokens: profile.maxOutputTokens });
  }
}

// usage_metadata es el campo estándar de LangChain.js que ChatOpenAI, ChatAnthropic y ChatGoogle
// pueblan en el AIMessage crudo (verificado contra el código fuente instalado de los tres
// paquetes, no contra una llamada real con las tres a la vez en esta sesión). Si algún proveedor
// deja de reportarlo, esto degrada a null — nunca inventa un conteo.
export function extractUsage(raw: { usage_metadata?: { input_tokens?: number; output_tokens?: number } } | undefined): ModelUsage {
  const usage = raw?.usage_metadata;
  return {
    inputTokens: typeof usage?.input_tokens === 'number' ? usage.input_tokens : null,
    outputTokens: typeof usage?.output_tokens === 'number' ? usage.output_tokens : null,
  };
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
    const configuredMessages = profile.structuredOutputMethod === 'jsonMode'
      ? [{ role: 'system' as const, content: 'Devuelve exclusivamente un objeto JSON que cumpla este esquema JSON: ' + JSON.stringify(z.toJSONSchema(schema)) }, ...messages]
      : messages;
    // includeRaw:true es lo único que da acceso al AIMessage crudo (y su usage_metadata) — sin
    // él, withStructuredOutput().invoke() solo devuelve el valor ya parseado y el conteo de
    // tokens de esta llamada se pierde para siempre.
    const { raw, parsed } = await client.withStructuredOutput(schema, {
      name: schemaName, includeRaw: true,
      ...(profile.structuredOutputMethod ? { method: profile.structuredOutputMethod } : {}),
    }).invoke(configuredMessages, {
      signal: AbortSignal.timeout(profile.timeoutMs),
    }) as { raw: RawMessage; parsed: unknown };
    // Con includeRaw, LangChain cambia cualquier fallo de su parser por parsed:null y se pierde
    // el motivo. Se recupera lo que el modelo sí devolvió para que schema.parse() del llamador
    // diga qué campo falló en vez de "expected object, received null".
    return { parsed: parsed ?? recoverStructured(raw), usage: extractUsage(raw) };
  };
}

type RawMessage = {
  usage_metadata?: { input_tokens?: number; output_tokens?: number };
  tool_calls?: { args?: unknown }[];
  content?: unknown;
  response_metadata?: { finish_reason?: string };
};

export function recoverStructured(raw: RawMessage): unknown {
  // Causa real vista en vivo: respuestas largas cortadas en maxOutputTokens dejaban un JSON a medias.
  if (raw.response_metadata?.finish_reason === 'length') {
    throw new OutputParserException('La respuesta del modelo se cortó al llegar al límite de salida del perfil (maxOutputTokens en config/models.*.json).');
  }
  const args = raw.tool_calls?.[0]?.args;
  if (args !== undefined) return args;
  const text = typeof raw.content === 'string' ? raw.content
    : Array.isArray(raw.content) ? raw.content.map((part) => (typeof part === 'string' ? part : (part as { text?: string })?.text ?? '')).join('')
    : '';
  const body = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  // OutputParserException (no Error): workflow.ts solo reintenta salidas mal formadas de ese tipo;
  // cualquier otro error se propaga y tumba la petición entera.
  if (!body) throw new OutputParserException('El modelo no devolvió una respuesta estructurada (salida vacía).');
  try {
    return JSON.parse(body);
  } catch {
    throw new OutputParserException(`El modelo no devolvió JSON válido (${body.length} caracteres${/[}\]]$/.test(body) ? '' : ', parece truncado'}): `
      + `${body.slice(0, 120)} … ${body.slice(-120)}`);
  }
}
