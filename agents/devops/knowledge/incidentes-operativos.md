> Adaptado de claude-skills (alirezarezvani, MIT) y headcount (cbrock84, MIT): incident-commander, observability-and-reliability, network-administration.

# Respuesta a incidentes operativos

## Antes de empezar
Este documento cubre caídas, degradaciones y despliegues fallidos. Si hay señal de intrusión, ransomware, fuga de datos o un agente actuando sin autorización, es incidente de seguridad: pásalo de inmediato a ciberseguridad (security-defense) y no borres evidencia.

Busca en la memoria corporativa: servicios afectados, últimos despliegues, cambios recientes, contactos y canal de avisos, clientes que dependen del servicio. Lo que no encuentres, márcalo FALTANTE. Tú clasificas, reconstruyes la línea de tiempo, propones mitigaciones y redactas avisos; ejecutar comandos, revertir o comunicar a clientes lo aprueba y hace un humano.

## Severidades (referencia general; tiempos por acordar con Adrián)
| Nivel | Señales | Respuesta |
|---|---|---|
| SEV1 | Servicio principal caído para todos, pérdida o corrupción de datos, facturación o cobro detenidos | Avisar de inmediato a infrastructure-lead y a Adrián; actualizaciones frecuentes |
| SEV2 | Degradación importante, una parte de usuarios o clientes afectada, flujo crítico de n8n detenido | Mismo turno; avisos periódicos |
| SEV3 | Una función afectada con alternativa disponible | Horario laboral |
| SEV4 | Cosmético, entorno de pruebas, hueco de monitoreo | Cola normal |
Ante la duda, declara y clasifica alto; bajar la severidad cuesta poco.

## Roles
En una empresa chica una persona puede tener varios, pero nómbralos: quien coordina (decide y comunica), quien opera (ejecuta cambios) y quien registra la línea de tiempo. Quien coordina no se pone a depurar.

## Primeros 15 minutos
1. Confirmar impacto: qué ve el usuario, desde cuándo, a quién afecta.
2. Clasificar severidad y abrir el registro del incidente.
3. Revisar lo que cambió: último despliegue, cambio de configuración, actualización del sistema, certificado, disco lleno, proveedor externo.
4. Diagnosticar por capas, de abajo hacia arriba: luz e internet de la oficina, red y DNS, contenedor o servicio, base de datos, aplicación.
5. Mitigar antes de arreglar: revertir el despliegue, apagar la bandera, reiniciar el servicio, pausar el flujo que duplica. Primero restaurar el servicio; la causa raíz después.

## Revertir o corregir hacia adelante
Revierte si el incidente empezó tras un cambio y la reversa está probada. Corrige hacia adelante solo si revertir es imposible (migración sin regreso) o más riesgoso. Documenta la decisión y quién la tomó.

## Avisos
Plantilla: servicio, severidad, inicio, impacto para el usuario, estado (investigando, mitigando, resuelto), qué se está haciendo, alternativa si existe, siguiente aviso. Solo hechos; nada de causas supuestas. El aviso a clientes lo redacta el puesto y lo aprueba un humano.

## Línea de tiempo
Una sola, con hora y fuente de cada evento: detección, declaración, cada acción, mitigación, resolución. Mide por separado el tiempo hasta detectar y el tiempo hasta resolver: una detección larga es un defecto de observabilidad y es lo que se repite.

## Revisión posterior sin culpables
Busca qué hizo posible la falla y qué impidió detectarla, no quién tocó al último. "Error humano" es una pregunta inicial, nunca la conclusión: ¿qué facilitó el error y por qué nada lo atrapó? Pocas acciones reales con dueño y fecha; quince acciones equivalen a ninguna.

## Qué entregar
Resumen en una línea, severidad, línea de tiempo, impacto (usuarios, clientes, tiempo), causa conocida y supuesta por separado, mitigación aplicada (marcada como propuesta o ejecutada con evidencia), acciones con dueño y fecha, y qué falta confirmar.

## Errores comunes
- Debatir si "de verdad es incidente" en vez de declararlo.
- Buscar la causa raíz con el servicio todavía caído.
- Hacer varios cambios a la vez durante la mitigación: ya no sabes cuál funcionó.
- Plan de respuesta guardado solo en el sistema que se cayó.
- Cerrar la revisión con "alguien fue descuidado".
