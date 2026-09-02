# Content Studio — public portfolio demo

Vue 3 **Content Studio** for browsing game content: entities, cross-references, CSV editors, search, and a reference graph. This repository ships **fictional sample data only** — no proprietary game assets.

## Live demo

Enable **GitHub Pages** (Settings → Pages → GitHub Actions) after pushing. The site deploys from `studio/dist` on every push to `main`.

## Local preview

```bash
cd studio
npm install
npm run build:demo
npm run preview:demo
```

Open the URL shown (usually `http://localhost:4173`). Demo mode is **read-only**.

## What's included

| Area | Sample |
|------|--------|
| Manifest | 2 quests, 1 event, 2 dialogues, 2 flags, 2 enemies, 3 items, 6 refs |
| CSV | Minimal enemy + item tables |
| Dialogues | JSON snippets searchable from the Search tab |
| Graph | Focus drill-down on `quest:demo_supply_run` etc. |

## Tech stack

- **Vue 3 + Vite + TypeScript**
- **TanStack Table** (CSV views)
- **Vue Flow** (reference graph)
- Static JSON manifest pattern (same contract as the private Godot monorepo)

## Private game repo

The full pipeline (Godot manifest generation, SET_FLAG runtime, CI validation) lives in a **private** repository. This public repo demonstrates the **authoring UI** and **content ID / manifest** architecture only.

## License

MIT (adjust as needed for your portfolio).
