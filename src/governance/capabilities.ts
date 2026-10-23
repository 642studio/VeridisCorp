import { CapabilityDefinition, CapabilityBinding } from './enterprise-contracts.js';

/** Catálogo independiente de puestos. No concede herramientas ni valida payloads JSON Schema. */
export class CapabilityCatalog {
  private readonly definitions: CapabilityDefinition[];
  private readonly bindings: CapabilityBinding[];
  constructor(definitions: CapabilityDefinition[], bindings: CapabilityBinding[]) {
    this.definitions = definitions.map((v) => CapabilityDefinition.parse(v));
    this.bindings = bindings.map((v) => CapabilityBinding.parse(v));
    const keys = this.definitions.map((d) => `${d.id}@${d.version}`);
    if (new Set(keys).size !== keys.length) throw new Error('Capacidades duplicadas');
    const bindingKeys = this.bindings.map((b) => `${b.agentId}:${b.capabilityId}@${b.capabilityVersion}`);
    if (new Set(bindingKeys).size !== bindingKeys.length) throw new Error('Asignaciones de capacidad duplicadas');
    for (const binding of this.bindings) this.get(binding.capabilityId, binding.capabilityVersion);
  }
  get(id: string, version: number): CapabilityDefinition {
    const value = this.definitions.find((d) => d.id === id && d.version === version);
    if (!value) throw new Error('Capacidad o versión inexistente');
    return structuredClone(value);
  }
  candidates(id: string, version: number): CapabilityBinding[] {
    this.get(id, version);
    return structuredClone(this.bindings.filter((b) => b.enabled && b.capabilityId === id && b.capabilityVersion === version));
  }
}
