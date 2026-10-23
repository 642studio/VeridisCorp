import { loadAgentCatalog, projectAgentDirectory } from './agent-files.js';
import type { OrganizationDefinition } from './organization.js';

export const companyOrganization: OrganizationDefinition = {
  id: '642-studio', name: 'VeridisCorp', executiveAgentId: 'ceo',
  departments: [
    { id: 'executive', name: 'Dirección general', mission: 'Priorizar objetivos, resolver conflictos entre áreas y consolidar entregas.', headAgentId: 'ceo', reviewerAgentId: 'review' },
    { id: 'finance', name: 'Finanzas', mission: 'Preparar presupuestos, análisis de costos y seguimiento financiero.', headAgentId: 'cfo', reviewerAgentId: 'finance-review' },
    { id: 'technology', name: 'Tecnología', mission: 'Diseñar y mantener software, datos e infraestructura.', headAgentId: 'cto', reviewerAgentId: 'review' },
    { id: "software", name: "Desarrollo de software", mission: "Diseñar, construir y verificar aplicaciones y servicios.", headAgentId: "software-lead", reviewerAgentId: "software-qa", parentDepartmentId: 'technology' },
    { id: "infrastructure", name: "Infraestructura y plataformas", mission: "Operar redes, despliegues, continuidad y observabilidad.", headAgentId: "infrastructure-lead", reviewerAgentId: "review", parentDepartmentId: 'technology' },
    { id: "data", name: "Datos y automatización", mission: "Gestionar datos, analítica e integraciones automatizadas.", headAgentId: "data-lead", reviewerAgentId: "review", parentDepartmentId: 'technology' },
    { id: "cybersecurity", name: "Ciberseguridad", mission: "Evaluar exposición, proteger sistemas y coordinar respuesta a incidentes.", headAgentId: "ciso", reviewerAgentId: "security-review", parentDepartmentId: 'technology' },
    { id: 'operations', name: 'Operaciones', mission: 'Organizar procesos, capacidad operativa y procedimientos.', headAgentId: 'coo', reviewerAgentId: 'review' },
    { id: 'projects', name: 'Gestión de proyectos', mission: 'Planificar entregas, dependencias, riesgos y seguimiento.', headAgentId: 'pm', reviewerAgentId: 'review' },
    { id: 'marketing', name: 'Marketing y comunicación', mission: 'Coordinar estrategia de marca, comunidad y contenido.', headAgentId: 'cmo', reviewerAgentId: 'marketing-review' },
    { id: 'people', name: 'Recursos Humanos', mission: 'Preparar perfiles, incorporación y documentación de procesos de personas.', headAgentId: 'hr', reviewerAgentId: 'people-review' },
    { id: 'intelligence', name: 'Investigación', mission: 'Recopilar, contrastar y sintetizar información con procedencia.', headAgentId: 'research-lead', reviewerAgentId: 'research-review' },
    { id: 'quality', name: 'Calidad', mission: 'Revisar criterios, evidencias y consistencia de entregables entre áreas.', headAgentId: 'quality-lead', reviewerAgentId: 'review' },
  ],
};

// El contenido editable de los agentes vive en agents/, fuera del código del motor.
export const companyAgents = loadAgentCatalog(projectAgentDirectory());
