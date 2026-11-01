import { OpenAIEmbeddings } from '@langchain/openai';

// Dimensión fija de veridis_runtime_v1.memory_records.embedding (ver src/runtime/database.ts).
// nomic-embed-text (Ollama local, perfil por defecto) produce 768. Cambiar de modelo de
// embeddings exige migrar esa columna y reembeber todo el corpus existente.
export const MEMORY_EMBEDDING_DIMENSIONS = 768;

export interface EmbeddingProfile {
  model: string;
  apiKeyEnv: string;
  baseURL?: string;
}

// Mismo patrón que src/office/model-providers.ts para el perfil local-code: @langchain/openai
// apunta a cualquier endpoint compatible con la API de OpenAI, incluido Ollama local. Por defecto
// usa Ollama en 127.0.0.1:11434 para no mandar el contenido de la memoria corporativa a ningún
// proveedor externo; VERIDIS_MEMORY_EMBEDDING_BASE_URL permite apuntar a otro (p. ej. OpenAI).
export function embeddingProfileFromEnv(env: NodeJS.ProcessEnv = process.env): EmbeddingProfile {
  return {
    model: env.VERIDIS_MEMORY_EMBEDDING_MODEL?.trim() || 'nomic-embed-text',
    apiKeyEnv: 'VERIDIS_MEMORY_EMBEDDING_API_KEY',
    baseURL: env.VERIDIS_MEMORY_EMBEDDING_BASE_URL?.trim() || 'http://127.0.0.1:11434/v1',
  };
}

export interface Embedder {
  readonly dimensions: number;
  embed(text: string): Promise<number[]>;
}

export function createEmbedder(profile: EmbeddingProfile, env: NodeJS.ProcessEnv = process.env): Embedder {
  // Mismo valor de compatibilidad que OLLAMA_API_KEY en docs/model-routing.md: el servidor local
  // lo ignora; nunca se manda ahí una clave real de otro proveedor.
  const apiKey = env[profile.apiKeyEnv]?.trim() || 'ollama';
  const client = new OpenAIEmbeddings({
    model: profile.model, apiKey,
    configuration: profile.baseURL ? { baseURL: profile.baseURL } : undefined,
  });
  return {
    dimensions: MEMORY_EMBEDDING_DIMENSIONS,
    async embed(text) {
      const vector = await client.embedQuery(text);
      if (vector.length !== MEMORY_EMBEDDING_DIMENSIONS) {
        throw new Error(`El modelo de embeddings "${profile.model}" devolvió ${vector.length} dimensiones; la columna espera ${MEMORY_EMBEDDING_DIMENSIONS}`);
      }
      return vector;
    },
  };
}
