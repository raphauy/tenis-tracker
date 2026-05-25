# ADRs — Architecture Decision Records

Decisiones arquitectónicas con contexto. Crear un ADR **solo** cuando se cumplen las tres condiciones:

1. **Difícil de revertir** — el costo de cambiar de opinión más adelante es real.
2. **Sorprendente sin contexto** — un futuro lector se preguntará "¿por qué hicieron esto así?".
3. **Resultado de un trade-off real** — había alternativas genuinas y se eligió una por razones específicas.

## Formato

Archivo: `NNNN-slug.md` (numeración secuencial, ej: `0001-uso-de-rsc-por-defecto.md`).

Contenido mínimo:

```markdown
# NNNN — Título corto

**Contexto:** 1-2 oraciones sobre la situación.
**Decisión:** qué se decidió hacer.
**Motivo:** por qué (la alternativa descartada y por qué no se eligió).
```
