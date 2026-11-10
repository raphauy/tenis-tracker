# Issue tracker: GitHub

El trabajo técnico de este repo (mapas de `/wayfinder`, specs de `/to-spec`, tickets de
`/to-tickets`) vive como **issues de GitHub en `raphauy/tenis-tracker`**. Todas las operaciones van
por el CLI `gh`, que infiere el repo del clon.

**Idioma:** títulos y cuerpos se escriben en **español con acentos**. Los nombres de las labels
quedan en inglés.

**El repo es público:** en un issue no van datos personales, credenciales ni nada que no pueda leer
cualquiera.

## Convenciones de `gh`

- **Crear**: `gh issue create --title "..." --body-file <archivo>` (o `--body` con heredoc).
- **Leer**: `gh issue view <n> --json number,title,body,labels,state,comments,url`. **Siempre con
  `--json`**: el `gh` instalado es 2.45.0 y `gh issue view --comments` solo falla.
- **Listar**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`,
  con `--label` y `--state` según haga falta.
- **Comentar**: `gh issue comment <n> --body "..."`
- **Labels**: `gh issue edit <n> --add-label "..."` / `--remove-label "..."`
- **Cerrar**: `gh issue close <n> --comment "..."`

### Sub-issues y dependencias

`gh` 2.45.0 no tiene `gh issue edit --parent` ni comandos de dependencias: ambos van por `gh api`
(ver "Operaciones de wayfinding"). Para el mapa de bloqueos solo sirve REST; GraphQL no expone
`blockedByIssues`.

## Cuando un skill dice "publicar en el issue tracker"

Crear un issue de GitHub. Vale también para las specs de `/to-spec`.

## Cuando un skill dice "traer el ticket relevante"

`gh issue view <n> --json number,title,body,labels,state,comments,url`.

## Label de modelo sugerido

Raphael trabaja con dos modelos en Claude Code: **Fable** para diseño y planificación, **Opus** para
implementación. **Todo issue que se crea** (tickets de wayfinder, specs, tickets de `/to-tickets`)
lleva una label que sugiere el modelo de la sesión que lo va a tomar:

- `model:fable`: grilling, diseño, decisiones caras de equivocar.
- `model:opus`: implementación, tareas, trabajo con el camino ya marcado.

Es una sugerencia visible en el tracker; el modelo lo elige Raphael al abrir la sesión. Un issue
`ready-for-agent` lleva siempre su label de modelo.

**Subagentes que lanza una sesión:** los research de `/wayfinder` y cualquier otro agente AFK se
disparan con `model: opus` explícito en la llamada. Sin el override heredan el modelo de la sesión
que los lanza (Fable, en un charting) y eso sale caro.

Los skills de Matt Pocock **no se editan** para esto (se actualizan desde upstream): la convención
vive acá.

## Tamaño de los tickets

Al partir una spec con `/to-tickets`, los tickets van **grandes**: el único tope es que uno entre en
una sola sesión de `/implement`. Se agrupa por lo que se demuestra junto, nunca por capa. Una spec
que entra en una sesión no se parte: se implementa directo desde el issue de la spec.

## Marcar el issue de la sesión

La statusline muestra en qué issue trabaja cada sesión (opt-in por proyecto: solo donde exista
`.claude/usa-github-issues`, que en este repo está). Al empezar a trabajar un ticket:

```bash
echo "#61 título corto" > ~/.claude/session-issue/$CLAUDE_CODE_SESSION_ID
```

Máximo 40 caracteres contando el `#NN`. Si la sesión cambia de ticket, se sobreescribe.

## Cerrar un ticket

La sesión que implementa un ticket es la que lo cierra. El disparador es el **go-ahead de Raphael
para el commit**: sin go-ahead no hay commit y el ticket queda abierto.

1. `pnpm run typecheck`, y `pnpm run build` después (en tweaks chicos de UI o copy alcanza con
   typecheck). Si el ticket tocó código con tests, `pnpm test:run`.
2. Proponer el commit describiendo el cambio. `git add` + `git commit` recién con el go-ahead, en
   `main`, sin crear branches. **Nunca `git push`**: eso lo hace Raphael.
3. `gh issue close <n> --comment "..."` en español, con el SHA del commit, lo que salió distinto de
   los criterios de aceptación y lo que quedó afuera.
4. Si eso cambia un ticket que viene después, `gh issue comment` en ese también.
5. **Si era el último ticket de una spec, se cierra también la spec**, con un comentario que nombre
   los tickets que la entregaron.

Si el trabajo cierra o adelanta un ADR, la entrada en `docs/adr/` va en el mismo commit que el
código (ver `docs/agents/domain.md`).

## Pull requests como superficie de pedidos

**PRs as a request surface: no.** Proyecto de un solo desarrollador, sin contribuciones externas.
`/triage` no mira PRs.

## Operaciones de wayfinding

Las usa `/wayfinder`. El **mapa** es un issue con issues **hijos** como tickets.

- **Mapa**: un issue con la label `wayfinder:map`, con el cuerpo Destination / Notes /
  Decisions-so-far / Fog. `gh issue create --label wayfinder:map`.
- **Ticket hijo**: un issue linkeado al mapa como sub-issue de GitHub, vía `gh api` sobre el
  endpoint de sub-issues. Labels: `wayfinder:<tipo>` (`research`/`prototype`/`grilling`/`task`), más
  la label de modelo. Una vez reclamado, el ticket queda asignado a quien lo trabaja.
- **Bloqueo**: las **dependencias nativas de issues** de GitHub. Se agrega una arista con
  `gh api --method POST repos/raphauy/tenis-tracker/issues/<hijo>/dependencies/blocked_by -F issue_id=<id-db-del-bloqueante>`,
  donde `<id-db-del-bloqueante>` es el **database id** numérico
  (`gh api repos/raphauy/tenis-tracker/issues/<n> --jq .id`), no el `#number` ni el `node_id`. Para
  leer el mapa de bloqueos:
  `gh api repos/raphauy/tenis-tracker/issues/<n>/dependencies/blocked_by --jq '.[] | "#\(.number) \(.state)"'`.
  Un ticket está desbloqueado cuando todos sus bloqueantes están cerrados.
- **Frontier query**: listar los hijos abiertos del mapa, descartar los que tengan un bloqueante
  abierto o un asignado; gana el primero en el orden del mapa.
- **Reclamar**: `gh issue edit <n> --add-assignee @me`, la primera escritura de la sesión.
- **Resolver**: `gh issue comment <n> --body "<respuesta>"`, después `gh issue close <n>`, y después
  agregar el puntero (gist + link) a Decisions-so-far del mapa.
