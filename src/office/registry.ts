import { AgentDefinition } from './contracts.js';
import { OrganizationDirectory, type OrganizationDefinition } from './organization.js';
import { companyAgents, companyOrganization } from './company-catalog.js';

// Una capacidad nueva no requiere ampliar un enum de identidades del motor.
export class AgentRegistry {
  private readonly definitions = new Map<string, AgentDefinition>();
  readonly organization?: OrganizationDirectory;

  constructor(definitions: AgentDefinition[], organization?: OrganizationDefinition) {
    for (const input of definitions) {
      const definition = AgentDefinition.parse(input);
      if (this.definitions.has(definition.id)) throw new Error('Agente duplicado: ' + definition.id);
      this.definitions.set(definition.id, definition);
    }
    if (organization) this.organization = new OrganizationDirectory(organization, this);
  }

  get(id: string): AgentDefinition {
    const definition = this.definitions.get(id);
    if (!definition) throw new Error('Agente no registrado: ' + id);
    return structuredClone(definition);
  }

  requireCapability(id: string, capability: string): void {
    if (!this.get(id).capabilities.includes(capability)) {
      throw new Error(`El agente ${id} no tiene la capacidad ${capability}`);
    }
  }

  find(capability: string): AgentDefinition[] {
    return [...this.definitions.values()]
      .filter((agent) => agent.capabilities.includes(capability))
      .map((agent) => structuredClone(agent));
  }

  list(): AgentDefinition[] {
    return [...this.definitions.values()]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((agent) => structuredClone(agent));
  }
}

export const officeRegistry = new AgentRegistry(companyAgents, companyOrganization);
