# Checklist de release — NINETY / draft-world-cup

Checklist prática para estabilizar, validar e publicar o MVP (M1–M6). Usa como guia antes de beta fechada ou launch público.

**Documentação de produto:** [MVP.md](./MVP.md) (fonte de verdade do scope).  
**Arquitetura:** [CLAUDE.md](./CLAUDE.md).

---

## 0. Decisão de launch

Escolhe **uma** opção antes de começar — define o que é obrigatório vs. opcional nas secções abaixo.

| Modo | O que expõe | Auth obrigatória? | Ranking / missões |
| ---- | ----------- | ----------------- | ----------------- |
| **A — Beta fechada** | Amigos / testers com URL | Não (localStorage `playerId` OK) | Informativo; spoofing aceitável |
| **B — Público (solo)** | `/`, highlights `/h/*` | Não | Missões desligadas ou “best effort” |
| **C — Público (completo)** | Solo + `/duel` + `/missions` + `/leaderboard` | **Sim** (better-auth + Google OAuth) | Server-side com identidade real |

> **Modo escolhido para este release: C.** Auth implementada em [`apps/web/AUTH-SETUP.md`](apps/web/AUTH-SETUP.md).

---

## 1. Congelar scope

- [x] Lista o que entra neste release — ver [`RELEASE-SCOPE.md`](./RELEASE-SCOPE.md) (v0.1.0, Mode C).
- [x] `git status` limpo numa branch `release/v0.1.0` (cut from `main` after PR #7 + #8).
- [x] `MVP.md` e docs de setup revistos (torneio pool de 8; auth em `AUTH-SETUP.md`).

---

## 2. Verificação automática (local / CI)

Corre na **raiz** do monorepo:

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm build          # emite dist/ — obrigatório antes do Convex
```

Corre em **apps/web**:

```bash
cd apps/web
pnpm typecheck
pnpm build          # next build — deve passar sem erros
```

### Catálogo

O servidor Convex e o cliente leem o **mesmo** `apps/web/public/catalog.json` (~5 MB). Após alterações ao catálogo:

```bash
# na raiz, se regeneraste dados
pnpm build:catalog   # ou pipeline overlay (photos, squads, etc.)
# copiar/sincronizar para apps/web/public/catalog.json se necessário
pnpm build           # motor
cd apps/web && npx convex dev --once   # ou deploy — rebundle duelCatalog
```

- [ ] `apps/web/public/catalog.json` existe e tem cenários (`scenarios.length > 0`).
- [ ] Tamanho aceitável para o host (Vercel serve estático; ~5 MB é OK mas mede LCP na primeira visita).

### Engine ↔ Convex em sync

- [ ] `pnpm build` na raiz **antes** de `npx convex deploy` (Convex importa `7a0-engine/dist`).
- [ ] `duelCatalog.ts` e `gameCatalog.ts` refletem o mesmo `hydrateCatalog` + `withCaptainTsubasa` que o cliente.

---

## 3. Smoke tests manuais

Usa dois perfis de browser (ou janela anónima) para online. Locale: testa pelo menos **PT** e **EN**.

### 3.1 Solo — `/`

- [ ] Novo draft: roll de cenário (bandeira + ano completo, ex. `🇫🇷 France · 2014`).
- [ ] Formation picker (defensivo / equilibrado / ofensivo) antes do XI.
- [ ] Slot vazio → popover com jogadores elegíveis para a posição.
- [ ] Rerolls globais (5) funcionam.
- [ ] Química (links país/teammates) e bónus de lendas visíveis no Build.
- [ ] Kick off → torneio solo resolve (grupos → meias → final).
- [ ] **Fast**: ticker minuto a minuto, play/pause, skip para resultado.
- [ ] **Ultra Fast**: resultado instantâneo.
- [ ] **Stats**: posse, remates, cantos, xG, etc.
- [ ] **Highlight**: botão gera link `/h/[code]`; abre noutro browser **sem login**.
- [ ] Link OG / preview (título com marcador e cenário).
- [ ] Missões: após jogo, progresso atualiza (requer `NEXT_PUBLIC_CONVEX_URL`).

### 3.2 Online — `/duel`

Pré-requisito: Convex a correr e `NEXT_PUBLIC_CONVEX_URL` definido.

- [ ] Wizard: nome → formação → build XI.
- [ ] Join pool: contador `x / 8` atualiza em tempo real.
- [ ] Com 2 humanos + timeout (60s) ou 8 humanos: torneio resolve.
- [ ] Mesmo bracket, classificação e campeão para ambos os clientes.
- [ ] Cada fixture do grupo jogável em Fast / Ultra Fast.
- [ ] “Search again” → novo draft + rejoin pool.
- [ ] Action log adulterado: servidor não credita vitória inválida (anti-cheat via `replayAndValidate`).

### 3.3 Missões & Boss — `/missions`

- [ ] Missões diárias (rotação UTC) e persistentes visíveis.
- [ ] Progresso após partida solo ou torneio.
- [ ] Boss da semana: mesmo XI para todos (ISO week).
- [ ] **Uma tentativa por dia UTC** — segunda tentativa bloqueada.
- [ ] Empate no Boss → penalties (`knockout: true`).

### 3.4 Leaderboard — `/leaderboard`

- [ ] Lista ELO após torneio online.
- [ ] “My rating” com histórico (se aplicável).

### 3.5 i18n & acessibilidade

- [ ] Language switcher: PT / EN / ES.
- [ ] Fast mode utilizável com leitor de ecrã (texto linear, controlos de play/pause).

### 3.6 Mobile / rede lenta

- [ ] Build + pitch utilizáveis em viewport estreita.
- [ ] Primeira carga com `catalog.json` — spinner/erro claro se falhar (sem fallback silencioso para catálogo diferente no duel).

---

## 4. Deploy

### 4.1 Convex (produção)

```bash
cd apps/web
pnpm build                    # na raiz, se ainda não correste
npx convex deploy             # produção apenas — não uses deploy em dev diário
```

- [ ] Deployment de produção criado no dashboard Convex.
- [ ] Schema migrado sem erros (`queue`, `tournaments`, `missions`, `bossAttempts`, `ratings`, …).
- [ ] URL de produção copiada para o frontend.

### 4.2 Next.js (ex.: Vercel)

Variáveis de ambiente mínimas:

| Variável | Obrigatória | Notas |
| -------- | ----------- | ----- |
| `NEXT_PUBLIC_CONVEX_URL` | Sim (modos A/B/C com backend) | URL do deployment Convex **prod** |

```bash
cd apps/web
pnpm build
pnpm start                    # smoke local do artefacto de produção
```

- [ ] `catalog.json` incluído no deploy (`public/`).
- [ ] Domínio custom configurado (se aplicável).
- [ ] HTTPS em todas as rotas.

### 4.3 Pós-deploy (produção)

- [ ] Abrir URL prod → solo completo.
- [ ] `/duel` com dois dispositivos reais (não só localhost).
- [ ] Highlight partilhado no WhatsApp/Twitter — preview correto.
- [ ] Convex dashboard: mutations `joinQueue`, `recordMatch`, `challengeBoss` sem erros em massa.

---

## 5. Critérios de aceitação (MVP §7)

Marca quando validado em **produção** ou staging equivalente:

- [ ] Solo: Fast e Ultra Fast a partir do **mesmo** timeline; skip em Fast funciona.
- [ ] Química e táticas alteram λ/resultado e aparecem no Build e stats.
- [ ] Até 8 jogadores em dispositivos diferentes veem o **mesmo** torneio server-resolved.
- [ ] Highlight link funciona sem login; stats pós-jogo corretos.
- [ ] Missões creditadas server-side; Boss 1×/dia UTC.
- [ ] Fast e Ultra Fast disponíveis em todos os fluxos de jogo.

---

## 6. Riscos conhecidos (não bloquear beta; bloquear launch público C)

| Risco | Impacto | Mitigação |
| ----- | ------- | --------- |
| `playerId` em localStorage | Spoof de missões/ELO | Modo A/B; auth real para modo C |
| Forças do catálogo autorais | Balanceamento diferente do 7a0 original | Comunicar na release; overlays curated |
| Pool timeout 60s | Muitos bots se tráfego baixo | Monitorizar % humanos vs bots (meta MVP ≥50% humanos) |
| `catalog.json` ~5 MB | LCP na primeira visita | CDN/cache; considerar compressão Brotli no host |
| Decisões abertas MVP §9 | Edge cases em empates de grupo | Documentar regra actual; calibrar depois |
| Sem CI no repo | Regressões silenciosas | Adicionar workflow `test` + `typecheck` + `next build` |

---

## 7. Métricas pós-launch (MVP §8)

Configura telemetria (`/api/metric` no app principal, se wired) e acompanha na primeira semana:

| Métrica | Meta MVP |
| ------- | -------- |
| Pools com 8 humanos (vs bot-fill) | ≥ 50% |
| Partidas em Fast (ticker) | ≥ 40% |
| Partidas com highlight partilhado | ≥ 15% |
| DAU em daily/missões | ≥ 25% |
| Latência sync Convex (p95) | < 400 ms |

---

## 8. Rollback

- [ ] Tag git do commit deployado (`git tag v0.x.y`).
- [ ] Convex: redeploy da função anterior via dashboard ou `npx convex deploy` a partir da tag.
- [ ] Vercel: promote deployment anterior.
- [ ] Comunicar downtime se schema Convex não for retrocompatível.

---

## 9. Follow-ups pós-MVP (não bloqueiam beta)

- [x] better-auth no lugar de `usePlayerId` + guards Convex (`ctx.auth`) — PR #7.
- [ ] CI GitHub Actions: `pnpm test`, `typecheck`, `build`, `apps/web build`.
- [ ] Atualizar `README.md` (milestones M4–M6) e `DUEL-SETUP.md` (torneio pool, não 1v1).
- [ ] Alinhar `MVP.md` §4.5 com química por links (`src/synergy.ts`), não só position-fit.
- [ ] Rate limiting / abuse em mutations públicas.

---

## Comandos rápidos (dev)

```bash
# Terminal 1 — raiz
pnpm build && pnpm test

# Terminal 2 — Convex dev
cd apps/web && npx convex dev

# Terminal 3 — Next.js
pnpm --filter web dev
```

URLs locais: `http://localhost:3000` · `/duel` · `/missions` · `/leaderboard` · `/h/[code]`
