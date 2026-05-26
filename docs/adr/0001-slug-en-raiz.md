# 0001 — Slug de jugador en la raíz (`/[slug]`)

**Contexto:** Cada jugador tiene un Perfil público compartible en una URL propia (ej. `/raphael-carvalho`). Había que decidir si el slug cuelga de un prefijo (`/u/[slug]`, `/dash/[slug]` como OnMind) o vive directo en la raíz (`/[slug]`).

**Decisión:** Segmento dinámico en la raíz: `/[slug]`. Next.js resuelve estático > dinámico, así que `/login`, `/admin`, `/api` ganan siempre sobre `/[slug]` y conviven. El costo se traslada a una **blocklist de slugs reservados** que el onboarding valida, sincronizada con toda ruta estática de primer nivel (presente y futura) + internos de Next.

**Motivo:** URLs más cortas y memorables, que es el punto de un perfil compartible. La alternativa con prefijo (`/u/…`) se descartó por ser menos limpia pese a evitar la blocklist. Es difícil de revertir (cambiar el esquema de URLs después rompe links compartidos) y exige disciplina: cada nueva ruta top-level debe agregarse a los reservados antes de existir, o colisiona con un slug ya tomado.
