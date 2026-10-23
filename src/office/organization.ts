import { z } from 'zod';
import { Id, unique, type AgentDefinition } from './contracts.js';

export const OrganizationDefinition = z.object({
  id: Id,
  name: z.string().trim().min(1),
  executiveAgentId: Id,
  departments: z.array(z.object({
    id: Id, name: z.string().trim().min(1), mission: z.string().trim().min(1),
    headAgentId: Id, reviewerAgentId: Id, parentDepartmentId: Id.optional(),
  }).strict()).min(1),
}).strict();
export type OrganizationDefinition = z.infer<typeof OrganizationDefinition>;
type RegistryView = { get(id: string): AgentDefinition; list(): AgentDefinition[] };
const managerial = new Set(['executive', 'head', 'manager']);

export class OrganizationDirectory {
  private readonly definition: OrganizationDefinition;
  constructor(input: OrganizationDefinition, private readonly registry: RegistryView) {
    this.definition = OrganizationDefinition.parse(input);
    unique(this.definition.departments.map((d) => d.id), 'Departamentos duplicados');
    for (const department of this.definition.departments) {
      const seen = new Set([department.id]);
      let parentId = department.parentDepartmentId;
      while (parentId) {
        if (seen.has(parentId)) throw new Error('Ciclo de departamentos');
        seen.add(parentId);
        const parent = this.definition.departments.find((d) => d.id === parentId);
        if (!parent) throw new Error('Departamento padre inexistente: ' + parentId);
        parentId = parent.parentDepartmentId;
      }
    }
    const ceo = registry.get(this.definition.executiveAgentId);
    if (ceo.organization?.level !== 'executive' || ceo.organization.reportsToId) {
      throw new Error('La dirección general debe ser la raíz del organigrama');
    }
    for (const agent of registry.list()) {
      const org = agent.organization;
      if (!org || !this.definition.departments.some((d) => d.id === org.departmentId)) {
        throw new Error('Departamento inexistente para ' + agent.id);
      }
      const seen = new Set([agent.id]);
      let cursor = agent;
      while (cursor.id !== ceo.id) {
        const managerId = cursor.organization?.reportsToId;
        if (!managerId) throw new Error('Agente sin vínculo con la dirección: ' + agent.id);
        if (seen.has(managerId)) throw new Error('Ciclo en el organigrama');
        seen.add(managerId);
        const manager = registry.get(managerId);
        if (!manager.organization || !managerial.has(manager.organization.level)) throw new Error('El superior debe ser un responsable autorizado');
        if (manager.id !== ceo.id && !this.containsDepartment(manager.organization.departmentId, cursor.organization!.departmentId)) {
          throw new Error('Una línea de reporte no puede cruzar departamentos fuera de su jerarquía');
        }
        cursor = manager;
      }
    }
    for (const department of this.definition.departments) {
      const head = registry.get(department.headAgentId);
      if (head.organization?.departmentId !== department.id || !['executive', 'head'].includes(head.organization.level)) {
        throw new Error('Responsable inválido para el departamento ' + department.id);
      }
      if (department.parentDepartmentId) {
        const parent = this.definition.departments.find((d) => d.id === department.parentDepartmentId)!;
        if (!this.canDelegate(parent.headAgentId, head.id)) {
          throw new Error('El subdepartamento debe depender del responsable de su área: ' + department.id);
        }
      }
      const reviewer = registry.get(department.reviewerAgentId);
      if (!reviewer.capabilities.includes('work.review') || !this.canReview(reviewer.id, head.id)) {
        throw new Error('Revisor inválido para el departamento ' + department.id);
      }
      for (const member of registry.list().filter((a) => a.organization!.departmentId === department.id)) {
        if (member.id !== head.id && !this.canDelegate(head.id, member.id)) {
          throw new Error('Integrante fuera de la línea de su departamento: ' + member.id);
        }
      }
    }
  }

  private containsDepartment(parentId: string, childId: string): boolean {
    let cursor: string | undefined = childId;
    while (cursor) {
      if (cursor === parentId) return true;
      cursor = this.definition.departments.find((d) => d.id === cursor)?.parentDepartmentId;
    }
    return false;
  }

  snapshot(): OrganizationDefinition { return structuredClone(this.definition); }
  executive(): AgentDefinition { return this.registry.get(this.definition.executiveAgentId); }
  isManager(id: string): boolean { return managerial.has(this.registry.get(id).organization?.level || ''); }
  team(managerId: string): AgentDefinition[] {
    return this.registry.list().filter((agent) => this.canDelegate(managerId, agent.id));
  }
  canDelegate(managerId: string, assigneeId: string): boolean {
    if (managerId === assigneeId || !this.isManager(managerId)) return false;
    const manager = this.registry.get(managerId);
    let cursor = this.registry.get(assigneeId);
    if (managerId !== this.definition.executiveAgentId && !this.containsDepartment(manager.organization!.departmentId, cursor.organization!.departmentId)) return false;
    const seen = new Set<string>();
    while (cursor.organization?.reportsToId && !seen.has(cursor.id)) {
      seen.add(cursor.id);
      if (cursor.organization.reportsToId === managerId) return true;
      cursor = this.registry.get(cursor.organization.reportsToId);
    }
    return false;
  }
  canReview(reviewerId: string, authorId: string): boolean {
    const reviewer = this.registry.get(reviewerId);
    const author = this.registry.get(authorId);
    return reviewerId !== authorId && reviewer.capabilities.includes('work.review') && Boolean(reviewer.organization)
      && (reviewer.organization!.departmentId === 'quality' || reviewer.organization!.departmentId === author.organization?.departmentId);
  }
}
