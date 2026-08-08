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
- [x] Étape 4 — Modules `accounts` + `transactions` (CRUD, import CSV multi-format, `balance-history`, stats ; sync Revolut stubbé en attendant des identifiants) + module `categories` minimal
- [x] Étape 5 — Module `budget` (génération auto mensuelle par copie du mois précédent, `actual_amount` dynamique, vue annuelle avec variance)
- [x] Étape 6 — Module `savings` (CRUD, objectifs préconfigurés à l'inscription, dépôts + jalons automatiques à 25/50/75/100%)
- [x] Étape 7 — Module `investments` (CRUD, entrées DCA, projection avec formule intérêts composés, jalons 20K/50K/100K/1M cross-comptes)
- [x] Étape 8 — Module `crypto` (CRUD wallets, sync Solana + Etherscan réels (RPC public / API V2 + CoinGecko), Crypto.com stubbé — signature vérifiée mais échoue en live sur le compte de l'utilisateur, à investiguer côté Crypto.com —, historique de snapshots)
- [x] Étape 9 — Module `collectibles` (architecture revue en cours d'étape : TCGdex gratuit pour les cartes singles + mode manuel/providers optionnels pour le scellé, remplace la Pokémon TCG API désormais payante ; CRUD, prix manuel, sync-prices, performance, recherche TCGdex, cron 3h)
- [ ] Étape 10 — Frontend (design system + pages)
- [ ] Étape 11 — Electron shell (packaging, CSP)
- [ ] Étape 12 — Couverture de tests
