> Adaptado de impeccable (pbakaus, Apache-2.0): critique, audit.

# Crítica y auditoría de interfaces con puntaje y severidad

Dos revisiones distintas: la **auditoría técnica** mide lo verificable en el código y lo renderizado; la **crítica de diseño** juzga si la pantalla sirve a su usuario. Ninguna corrige: documentan para que frontend corrija.

## Antes de empezar
Busca primero en la memoria corporativa y en el entregable; pide lo que falte y márcalo FALTANTE:
- Pantalla o flujo exacto (ruta del archivo o URL) y la tarea principal del usuario.
- Capturas en escritorio y celular, en claro y oscuro, de los estados: inicial, cargando, error, vacío, sin permiso.
- La dirección de diseño aprobada y la marca confirmada.
- Salidas de herramientas que corrió el autor (axe, Lighthouse, detector). QA no tiene sandbox: lo que no venga con salida se califica "inspeccionado", nunca "ejecutado".

## Independencia
Haz la crítica de diseño antes de leer resultados de detectores: la salida automática ancla el juicio. Luego compara: dónde coinciden, qué atrapó solo el detector y qué hallazgos son falsos positivos. El autor no se revisa a sí mismo.

## Auditoría técnica (cinco dimensiones, 0–4 cada una)
| Dimensión | Qué buscar |
|---|---|
| Accesibilidad | Contraste bajo 4.5:1 (3:1 grande), foco invisible o trampas, `div` en vez de `button`, campos sin etiqueta, imágenes sin `alt`, movimiento sin alternativa reducida |
| Rendimiento | Animar ancho, alto o posición; imágenes sin carga diferida; dependencias sin usar; renders de más en React |
| Temas | Colores sueltos fuera de los tokens; modo oscuro roto o sin contraste |
| Responsivo | Anchos fijos, scroll horizontal, objetivos táctiles bajo 24×24 px, texto que rompe al ampliarlo, gestos que fallan en touch |
| Integridad | Atajos repetidos, deriva del sistema de diseño, contenido decorativo o engañoso, estructura que serviría igual a otro producto |
Escala: 0 inaceptable, 1 fallas mayores, 2 parcial, 3 bien con huecos menores, 4 excelente. Bandas sobre 20, como referencia: 18–20 excelente, 14–17 bien, 10–13 aceptable, 6–9 pobre, 0–5 crítico.

## Crítica de diseño
- **Especificidad primero:** ¿se siente hecha para este producto o intercambiable? Señales de plantilla: tarjetas idénticas, etiqueta en mayúsculas sobre cada título, degradados violeta, emoji como íconos, texto con signos de exclamación.
- **Heurísticas de Nielsen, 0–4 cada una:** visibilidad del estado, lenguaje del usuario, control y salida, consistencia, prevención de errores, reconocer en vez de recordar, eficiencia, diseño mínimo, recuperación de errores, ayuda. Total sobre 40; marca `n/a` con motivo la que no aplique (p. ej. ayuda en una landing) y reporta sobre el máximo aplicable (24/32 = 75 %). Como referencia: 90 %+ excelente, 70 %+ bien, 50 %+ aceptable, 30 %+ pobre. Sé honesto: un 4 es excepcional.
- **Carga cognitiva:** ¿una tarea principal sin distracciones? ¿Grupos de 4 o menos? ¿Jerarquía evidente? ¿4 o menos opciones visibles por decisión? ¿Hay que recordar algo de la pantalla anterior? ¿Lo avanzado se revela cuando hace falta? 0–1 fallas bien, 2–3 atender pronto, 4+ crítico.
- **Personas:** recorre la tarea principal como 2–3 de estas y anota qué se rompe, con elementos concretos: primerizo confundido, usuario experto con prisa, quien depende de teclado o lector de pantalla, quien prueba casos extremos, usuario distraído en celular con una mano.

## Severidad de cada hallazgo
- **P0 bloqueante:** impide completar la tarea (botón inalcanzable por teclado, error sin salida, dato perdido).
- **P1 mayor:** dificultad seria o incumple WCAG AA.
- **P2 menor:** molestia con alternativa.
- **P3 pulido:** sin impacto real. Pocos: una cola larga entierra lo importante.
Si dudas entre dos: ¿el usuario llamaría a soporte por esto? Entonces es P1 o más.
Cada hallazgo: severidad, nombre, ubicación (componente, archivo, línea), impacto en el usuario, criterio WCAG si aplica y corrección concreta. Nada de "considerar explorar".

## Cuándo rechazar
- **Rechazado:** cualquier P0; un P1 abierto en algo público o que maneje dinero, datos personales o accesos; estados de error o vacío ausentes.
- **Aprobado con condiciones:** solo P2 y P3, o P1 con excepción aprobada por un humano, registrada con responsable y fecha.
- **Aprobado:** sin P0 ni P1, evidencia de los estados y huecos declarados.
El puntaje no decide solo: 32/40 con un P0 sigue rechazado. Liberar lo decide un humano.

## Qué entregas
```
Pantalla: <ruta>   Método: <crítica primero / detector después>
Auditoría: tabla de dimensiones, total /20
Crítica: especificidad, heurísticas, carga cognitiva, personas
Hallazgos: P0 → P3 con ubicación e impacto
Lo que funciona: 2–3 puntos concretos
No revisado: qué y por qué
Veredicto: rechazado / con condiciones / aprobado — motivo
```

## Errores comunes
- Puntuar alto por cortesía o marcarlo todo P0.
- Reportar hallazgos del detector sin verificarlos en contexto.
- Revisar solo el estado inicial en escritorio.
