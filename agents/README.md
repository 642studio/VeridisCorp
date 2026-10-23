# Agentes de VeridisCorp

Esta es la ubicación editable de los agentes. El catálogo actual contiene 56 perfiles iniciales, pendientes de revisar y configurar con Adrián. No es todavía la lista definitiva de todos los agentes que necesitará el ecosistema.

Consulta el [inventario inicial](INVENTORY.md) para navegar por departamento y puesto.

## Estructura de cada agente

```text
agents/
  index.json
  cfo/
    config.json
    instructions.md
    context.md
    knowledge/
      README.md
  _template/
```

| Archivo | Qué se escribe | Cómo se utiliza |
| --- | --- | --- |
| `instructions.md` | Responsabilidades, reglas, criterios y forma de trabajar | Se incorpora a las instrucciones de sistema del puesto |
| `context.md` | Datos estables confirmados del área y la información que falta | Se entrega como contexto del propio agente, separado de las reglas |
| `config.json` | ID, versión, nombre, capacidades, herramientas permitidas y posición en el organigrama | Se valida al cargar el registro |
| `knowledge/` | Referencias de texto pertinentes al puesto | Solo se cargan las declaradas en `config.json` |
| `index.json` | IDs de las carpetas incorporadas al catálogo | Controla explícitamente qué perfiles carga el motor |

El coordinador y los responsables reciben metadatos de los otros agentes, sin sus instrucciones, contexto privado de puesto ni documentos. Cada agente recibe sus propios archivos y los entregables pertinentes del encargo. Esto reduce contexto innecesario; no reemplaza los controles de acceso pendientes para una API multiusuario.

## Estado de la preparación

Se conservaron las instrucciones existentes y se ampliaron los puestos y subdepartamentos según el inventario. Los contextos contienen únicamente el ecosistema, dirección humana, departamento, misión, superior y etapa conocidos. No se inventaron políticas financieras, métricas, datos de clientes ni procedimientos internos. Las referencias de cada agente comienzan vacías.

La configuración inicial permite seguir ejecutando las simulaciones. Estos perfiles aún requieren definición detallada, documentos reales, selección de modelos y evaluación antes de uso operativo. Tener carpeta no acredita herramientas conectadas ni autorización para acciones externas.

## Agregar referencias

Guarda, por ejemplo, `procedimiento.md` dentro de `knowledge/` y agrega una entrada a la lista `knowledge` del `config.json` de ese agente:

```json
{
  "id": "procedimiento-001",
  "title": "Procedimiento validado del área",
  "path": "procedimiento.md"
}
```

`path` es relativo a `knowledge/`. El cargador acepta `.md`, `.txt` y `.json`, hasta diez referencias, 32.000 bytes por archivo y 64.000 bytes de referencias por agente. Los archivos deben permanecer dentro de esa carpeta, incluso al resolver enlaces simbólicos. `instructions.md` y `context.md` admiten hasta 16.000 bytes cada uno. No se incorporan carpetas o documentos por exploración automática.

Los documentos declarados se leen al iniciar el proceso; su contenido y hash forman parte de la definición cargada y de la huella de compatibilidad del checkpoint. No hay todavía búsqueda semántica ni selección automática de fragmentos. Para documentos grandes se implementará recuperación de contexto en otra etapa. No guardar credenciales en estos archivos.

## Agregar o configurar un agente

1. Validar primero que el puesto forma parte del inventario que acordemos.
2. Copiar `_template/` a una carpeta con un ID estable.
3. Completar `config.json`, instrucciones, contexto y referencias. El ID de configuración debe coincidir con la carpeta.
4. Añadir ese ID a `index.json`. Las carpetas no incluidas, como `_template/`, no se cargan.
5. Si es un área nueva, actualizar sus responsables y revisión en `src/office/company-catalog.ts`.
6. Configurar sus modelos en la política central descrita en `docs/model-routing.md`.
7. Ejecutar las verificaciones y evaluar encargos representativos del puesto.

Las reglas generales y contratos siguen en el motor. Un texto de contexto o referencia no cambia las herramientas permitidas, el organigrama ni los permisos de delegación.

## Carga y despliegue

`src/office/agent-files.ts` carga estos archivos y `company-catalog.ts` conserva la estructura de departamentos. El cargador encuentra `agents/` tanto desde TypeScript como desde el código compilado, sin depender del directorio actual. Al desplegar se deben conservar `agents/`, `config/` y `dist/` dentro de la misma raíz de proyecto; copiar solo `dist/` no incluye los perfiles editables.

Los cambios se aplican al reiniciar el proceso. No hay recarga automática. Cambiar reglas, contexto o referencias modifica la huella del registro y bloquea la continuación silenciosa de trabajos anteriores; estos requieren una migración explícita o un expediente nuevo. Las versiones iniciales migradas a archivos son `2.1.0`; los perfiles nuevos o modificados en la ampliación usan `2.2.0` y la firma del adaptador es `office-model-adapter.v3`.

## Próxima etapa

Revisar el inventario por departamentos, decidir cuáles puestos conservar, agregar o dividir, priorizar los primeros agentes y luego configurarlos individualmente. La plantilla prepara esa revisión y no fija todavía el tamaño final de la oficina.
