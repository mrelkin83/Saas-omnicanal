# PROMPT DE ARRANQUE — Pegar a Claude Code en la primera sesión

Hola Claude Code. Vamos a construir desde cero un proyecto SaaS llamado **Plataforma Omnicanal**. No existe código previo en este repositorio.

## Documento maestro

En este repositorio existe un único documento llamado `PROMPT_MAESTRO_v7_UNIFICADO.md`. **Lee ese documento COMPLETO antes de escribir una sola línea de código.** Es la única fuente de verdad. Ignora cualquier otro documento que veas con nombres como "v5", "v6", "parche", "design system", "modulos faltantes" — esos están deprecados y no se usan.

## Cómo vamos a trabajar

1. **Implementarás el proyecto fase por fase**, en el orden exacto que indica la Sección 11 del documento maestro (Fase 0 → Fase 1 → ... → Fase 11).

2. **Cada fase termina con un bloque "✅ CHECKPOINT"** que contiene comandos exactos. Antes de declarar una fase como completa, ejecutarás cada uno de esos comandos y me mostrarás el output real. Si un comando falla, NO avanzas a la siguiente fase — corriges y vuelves a verificar.

3. **No saltes fases ni mezcles trabajo de fases distintas.** Si la Fase 4 necesita algo que "debería estar" pero no existe porque era de Fase 5, dime y resolvemos juntos antes de avanzar.

4. **Mantén un archivo `PROGRESO.md` en la raíz.** Al cerrar cada fase, escribe ahí:
   - Qué tareas se completaron
   - Output de cada comando del checkpoint
   - Cualquier decisión de implementación relevante que tomaste
   - Lo que sigue en la próxima fase

5. **Commits frecuentes.** Un commit por sub-tarea (no uno gigante por fase). Mensajes en inglés, descriptivos. Cada vez que agregues una dependencia, el commit message debe explicar por qué.

6. **Reglas innegociables** (también listadas en la Sección "Reglas de oro" del documento maestro):
   - TypeScript strict, cero `any`, cero `// TODO`, cero stubs.
   - Código en inglés. Strings/UI/system-prompts en español colombiano.
   - El patrón "IA recolecta, Sistema ejecuta" es sagrado.
   - Docker Compose debe funcionar desde la Fase 0 — no lo dejes para el final.
   - Cada query con `tenant_id` pasa por el plugin tenant resolver.
   - Cero dependencias que no estén justificadas.

## Cómo te voy a preguntar y cómo respondes

- Si **algo del documento maestro es ambiguo o contradictorio**, pregúntame antes de inventar. Mejor 30 segundos de pregunta que 3 horas de refactor.
- Si **propones una mejora arquitectónica** sobre lo que dice el documento, hazlo explícito como propuesta: "Estoy viendo X en la Sección Y, propongo cambiar a Z porque… ¿procedo?" Y esperas mi respuesta.
- Si **necesitas hacer algo que requiere mi acción** (configurar DNS, conseguir API key, escanear QR, exportar cookies de FB), detente y dímelo claramente en una lista numerada de pasos para mí.

## Empieza ahora

1. Lee `PROMPT_MAESTRO_v7_UNIFICADO.md` completo.
2. Confírmame que lo leíste resumiendo en 5 bullets las decisiones arquitectónicas clave que vas a respetar.
3. Si tienes dudas críticas antes de empezar, hazlas en una sola tanda (máximo 5 preguntas).
4. Empieza la **Fase 0 — Bootstrap del monorepo**.

Vamos.
