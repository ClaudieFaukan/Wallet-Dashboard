# Wallet Dashboard

Application desktop Mac de gestion de finances personnelles (comptes, budget, épargne, investissements, crypto, collectibles Pokémon). Electron + API REST Node/TypeScript + PostgreSQL, frontend React.

La spec complète du projet est dans [`base.md`](./base.md).

## Stack

| Couche        | Techno                                                                             |
| ------------- | ---------------------------------------------------------------------------------- |
| Desktop shell | Electron                                                                           |
| Backend       | Node.js 20+, TypeScript strict, Express 5, PostgreSQL 16 via Drizzle ORM           |
| Frontend      | React 18, Vite, TailwindCSS v4, Recharts, TanStack Query, Zustand                  |
| Auth          | JWT (access 15min + refresh 7j en cookie httpOnly) + déverrouillage Touch ID (Mac) |
| Packaging     | electron-builder (.dmg Mac)                                                        |
| Tests         | Vitest + Supertest                                                                 |

## Structure

```
electron/   # Shell Electron (main + preload)
backend/    # API REST découplée (Express, modules par feature)
frontend/   # App React (Vite)
shared/     # Types TypeScript partagés backend/frontend
```

## Prérequis

- Node.js 20+
- PostgreSQL 16 (local ou Docker)

## Setup

```bash
npm install
cp backend/.env.example backend/.env   # renseigner DATABASE_URL, JWT_SECRET (min 64 chars)
npm run db:migrate
```

Les tests backend utilisent une base Postgres séparée (`vitest.config.ts`, DB `wallet_dashboard_test`) pour ne jamais toucher aux données de dev — la créer et la migrer une fois :

```bash
createdb wallet_dashboard_test
DATABASE_URL=postgresql://<user>@localhost:5432/wallet_dashboard_test npm run db:migrate --workspace=backend
```

## Scripts

```bash
npm run dev          # lance backend + frontend + electron en parallèle
npm run build        # build backend + frontend + electron
npm run test         # tests backend (vitest)
npm run lint         # eslint sur tout le repo
npm run format       # prettier --write
npm run package:mac  # build + package .dmg
```

## État d'avancement

- [x] Étape 1 — Setup monorepo (workspaces npm, tsconfig strict, ESLint/Prettier, scaffolds des 4 packages)
- [x] Étape 2 — Schéma Drizzle (16 tables) + migration initiale
- [x] Étape 3 — Backend core (env, middlewares, module `auth` register/login/refresh/logout) + IPC Touch ID côté Electron (main + preload)
- [ ] Étape 4 — Modules `accounts` + `transactions` (CRUD, import CSV, sync Revolut)
- [ ] Étape 5 — Module `budget`
- [ ] Étape 6 — Module `savings`
- [ ] Étape 7 — Module `investments` (projections DCA)
- [ ] Étape 8 — Module `crypto` (Etherscan / Solana / Crypto.com)
- [ ] Étape 9 — Module `collectibles` (Pokémon TCG API)
- [ ] Étape 10 — Frontend (design system + pages)
- [ ] Étape 11 — Electron shell (packaging, CSP)
- [ ] Étape 12 — Couverture de tests
