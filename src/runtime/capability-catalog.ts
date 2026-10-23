import { Ajv } from 'ajv';
import { z } from 'zod';
import { CapabilityCatalog } from '../governance/capabilities.js';
import { CapabilityDefinition } from '../governance/enterprise-contracts.js';
import { Content, Review } from './contracts.js';
const GenerateInput = z.object({ brief: z.string().trim().min(1).max(8000) }).strict();
const ReviewInput = GenerateInput.extend({ text: Content.shape.text }).strict();
const schema = (value: z.ZodObject) => {
 const { $schema: _draft, ...definition } = z.toJSONSchema(value, { target: 'draft-7' });
 return definition;
};
const definitions = [
 CapabilityDefinition.parse({ schemaVersion: 1, id: 'content.draft', version: 1, description: 'Preparar borrador del brief',
  inputSchema: schema(GenerateInput), outputSchema: schema(Content), prerequisites: [], requiredTools: [], risks: ['Afirmaciones sin sustento'], successCriteria: ['Texto responde al brief'], modalities: ['text'] }),
 CapabilityDefinition.parse({ schemaVersion: 1, id: 'work.review', version: 1, description: 'Revisar independientemente la pieza del piloto',
  inputSchema: schema(ReviewInput), outputSchema: schema(Review), prerequisites: ['content.draft'], requiredTools: [], risks: ['Aceptar contenido incorrecto'], successCriteria: ['Aceptación explícita y explicación'], modalities: ['text'] }),
];
export const pilotCapabilities = new CapabilityCatalog(definitions, [
 { agentId: 'content', capabilityId: 'content.draft', capabilityVersion: 1, specialization: 'specialist', enabled: true },
 { agentId: 'review', capabilityId: 'work.review', capabilityVersion: 1, specialization: 'specialist', enabled: true },
]);
const ajv = new Ajv({ strict: true, allErrors: false, coerceTypes: false, removeAdditional: false });
const validators = new Map(definitions.map((definition) => [definition.id, {
 input: ajv.compile(definition.inputSchema), output: ajv.compile(definition.outputSchema),
}]));
export function validateCapability(capability: string, direction: 'input' | 'output', value: unknown) {
 const validate = validators.get(capability)?.[direction];
 if (!validate || !validate(value)) throw new Error('Contrato JSON Schema de capacidad inválido');
}
