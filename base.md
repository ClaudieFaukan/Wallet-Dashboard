# Prompt Claude Code — Personal Finance Dashboard (Electron + API REST)

## Contexte général

Tu vas construire une application de gestion de finances personnelles complète. C'est une app **Mac desktop** construite avec **Electron**, un backend **API REST** en **Node.js / TypeScript / Express**, une base de données **PostgreSQL**, et un frontend **React / TypeScript**. L'objectif est que l'app soit un `.dmg` installable sur Mac, avec un backend embarqué dans Electron (processus enfant Node).

L'architecture est conçue pour être **extensible vers une app mobile** (React Native) dans une seconde phase : le backend API REST doit être totalement découplé de l'Electron shell.

---

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Desktop shell | Electron (dernière version stable) |
| Backend | Node.js 20+, TypeScript strict, Express 5 |
| Base de données | PostgreSQL 16 via Drizzle ORM |
| Frontend | React 18, TypeScript, Vite, TailwindCSS v4, Recharts |
| Auth | JWT (access token 15min + refresh token 7j, stocké en httpOnly cookie) |
| Packaging | electron-builder (.dmg pour Mac) |
| Tests | Vitest (unitaires), Supertest (intégration API) |
| Linter/Format | ESLint + Prettier, configs strictes |

---

## Architecture du projet

```
finance-dashboard/
├── electron/                  # Shell Electron
│   ├── main.ts                # Main process, spawn backend, BrowserWindow
│   ├── preload.ts             # Contextbridge (IPC sécurisé)
│   └── ipc/                   # Handlers IPC si nécessaire
│
├── backend/                   # API REST découplée
│   ├── src/
│   │   ├── app.ts             # Express app factory
│   │   ├── server.ts          # Entry point (listen)
│   │   ├── config/
│   │   │   ├── env.ts         # Validation env vars (zod)
│   │   │   └── database.ts    # Connexion Drizzle/PG
│   │   ├── db/
│   │   │   ├── schema/        # Schémas Drizzle (un fichier par domaine)
│   │   │   └── migrations/    # Migrations SQL générées
│   │   ├── modules/           # Architecture MVC par feature
│   │   │   ├── auth/
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── auth.routes.ts
│   │   │   │   └── auth.schema.ts   # Validation Zod des inputs
│   │   │   ├── accounts/
│   │   │   ├── transactions/
│   │   │   ├── budget/
│   │   │   ├── savings/
│   │   │   ├── investments/
│   │   │   ├── crypto/
│   │   │   └── collectibles/
│   │   ├── shared/
│   │   │   ├── middleware/
│   │   │   │   ├── auth.middleware.ts       # Vérification JWT
│   │   │   │   ├── errorHandler.middleware.ts
│   │   │   │   ├── rateLimiter.middleware.ts
│   │   │   │   └── validate.middleware.ts   # Validation Zod
│   │   │   ├── types/
│   │   │   └── utils/
│   │   └── integrations/      # Clients API tierces
│   │       ├── revolut/
│   │       ├── pokemon-tcg/
│   │       └── crypto/
│   └── tests/
│
├── frontend/                  # React app (Vite)
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── features/          # Feature-based (miroir du backend)
│   │   │   ├── dashboard/
│   │   │   ├── accounts/
│   │   │   ├── budget/
│   │   │   ├── savings/
│   │   │   ├── investments/
│   │   │   ├── crypto/
│   │   │   └── collectibles/
│   │   ├── components/        # UI partagée uniquement
│   │   │   ├── charts/        # Wrappers Recharts réutilisables
│   │   │   ├── layout/
│   │   │   └── ui/            # Primitives (Button, Card, Badge...)
│   │   ├── lib/
│   │   │   ├── api.ts         # Client HTTP (axios, interceptors JWT)
│   │   │   └── queryClient.ts # React Query config
│   │   └── store/             # Zustand (état global léger)
│
└── shared/                    # Types TypeScript partagés backend/frontend
    └── types/
```

---

## Sécurité — règles non négociables

- **Toutes les routes** (sauf `/api/v1/auth/login`) sont protégées par le middleware JWT
- Valide **tous les inputs** avec Zod avant tout traitement (middleware `validate`)
- **Rate limiting** sur les routes auth (max 10 req/15min par IP)
- **Helmet.js** sur Express (headers de sécurité)
- **CORS** strict : origine unique `electron://` en prod, `localhost:5173` en dev
- **Aucune clé privée** ne transite jamais : les intégrations crypto sont en lecture seule via adresse publique uniquement
- Variables d'environnement **validées au démarrage** via Zod (pas de `process.env.X` direct dans le code)
- **bcrypt** pour le hash du mot de passe utilisateur (cost factor 12)
- Refresh token en base (table `refresh_tokens`, révocable)
- **SQL injection impossible** : utilise uniquement les query builders Drizzle, jamais de template string SQL

---

## Base de données — schéma Drizzle

Crée les tables suivantes avec Drizzle ORM (PostgreSQL). Utilise des **UUIDs** comme clés primaires (`gen_random_uuid()`). Toutes les tables ont `created_at` et `updated_at` automatiques.

```
users                  → id, email, password_hash, name, currency (défaut 'EUR')
refresh_tokens         → id, user_id (FK), token_hash, expires_at, revoked_at

accounts               → id, user_id, name, type (checking|savings|investment), 
                         institution, balance, currency, color, icon, is_active
transactions           → id, account_id, amount, currency, type (income|expense|transfer),
                         category_id, description, date, source (manual|revolut_api|csv_import),
                         external_id (pour déduplications), notes
categories             → id, user_id, name, type (income|expense), color, icon, is_default

budget_periods         → id, user_id, month (DATE), total_income, total_planned
budget_lines           → id, budget_period_id, category_id, planned_amount, actual_amount

savings_goals          → id, user_id, name, target_amount, current_amount, 
                         deadline, color, icon, type (emergency_fund|custom)
savings_milestones     → id, goal_id, name, target_amount, reached_at

investment_accounts    → id, user_id, name, platform, current_value, currency
investment_entries     → id, investment_account_id, date, amount_invested, 
                         portfolio_value, notes
investment_milestones  → id, user_id, amount (20000|50000|100000|1000000), reached_at

crypto_wallets         → id, user_id, name, platform (metamask|photon|crypto_com),
                         address, chain (ethereum|solana), is_active
crypto_snapshots       → id, wallet_id, fetched_at, total_value_usd, raw_data (jsonb)

collectible_items      → id, user_id, type (pokemon_card), name, set_name, 
                         card_number, condition, purchase_price, purchase_date,
                         tcg_product_id, image_url, notes
collectible_price_snapshots → id, item_id, fetched_at, market_price, source
```

---

## Modules — comportement attendu

### Module `auth`
- `POST /api/v1/auth/register` — premier lancement uniquement (si 0 user en base)
- `POST /api/v1/auth/login` — retourne access_token (body) + set refresh_token (httpOnly cookie)
- `POST /api/v1/auth/refresh` — lit le cookie, retourne nouveau access_token
- `POST /api/v1/auth/logout` — révoque le refresh_token en base

### Module `accounts`
- CRUD complet sur les comptes
- `GET /api/v1/accounts/:id/balance-history` — historique du solde sur N jours
- `POST /api/v1/accounts/:id/sync/revolut` — déclenche sync Revolut API
- `POST /api/v1/accounts/:id/import/csv` — upload CSV, parsing intelligent (détecte format Revolut / Trade Republic / Caisse d'Épargne / BNC), déduplique via `external_id`

### Module `transactions`
- CRUD complet
- Filtres : `account_id`, `category_id`, `date_from`, `date_to`, `type`, `search`
- Pagination cursor-based
- `GET /api/v1/transactions/stats` — agrégats par catégorie, par mois

### Module `budget`
- Génère automatiquement un budget mensuel (copie du mois précédent si existant)
- `GET /api/v1/budget/current` — budget du mois en cours avec `actual_amount` calculé dynamiquement depuis les transactions
- `GET /api/v1/budget/:year` — vue annuelle avec variance mois par mois

### Module `savings`
- CRUD sur les objectifs d'épargne
- Objectifs préconfigurés à la création du compte : "Épargne de précaution 6 mois" et "Épargne de précaution 1 an" (montants cibles calculés automatiquement depuis la moyenne des dépenses des 3 derniers mois × 6 ou × 12)
- `POST /api/v1/savings/:id/deposit` — ajoute un mouvement d'épargne et met à jour `current_amount`
- Vérification automatique des jalons à chaque dépôt (crée `savings_milestones` si franchi)

### Module `investments`
- CRUD sur les comptes d'investissement
- `POST /api/v1/investments/:id/entry` — enregistre une entrée DCA (date, montant investi, valeur du portefeuille)
- `GET /api/v1/investments/:id/projection` — calcule les projections de rendement :
    - Paramètres : `monthly_contribution`, `annual_rate` (variable, défaut 7%), `years`
    - Retourne : tableau mois par mois avec valeur projetée + date estimée d'atteinte des jalons 20K/50K/100K/1M
    - Formule : capitalisation mensuelle composée `V(t) = V0*(1+r)^t + PMT*((1+r)^t - 1)/r`
- `GET /api/v1/investments/milestones` — liste des jalons atteints et prochains jalons avec progression

### Module `crypto`
- CRUD wallets (on stocke juste l'adresse publique, jamais de clé privée)
- `POST /api/v1/crypto/wallets/:id/sync` — fetch balance on-chain :
    - **Ethereum / MetaMask** : via Etherscan API (gratuit, clé API requise)
    - **Solana / Photon** : via Solana RPC public (`getBalance`, `getTokenAccountsByOwner`)
    - **Crypto.com** : via Crypto.com Exchange API v2 (clé API lecture seule, configurée par l'utilisateur)
- Stocke un snapshot à chaque sync
- `GET /api/v1/crypto/wallets/:id/history` — évolution de la valeur dans le temps

### Module `collectibles` (Cartes Pokémon)
- CRUD sur les cartes (prix d'achat saisi une fois)
- `POST /api/v1/collectibles/sync-prices` — met à jour les prix via **Pokémon TCG API** (`api.pokemontcg.io`, gratuite, clé API optionnelle pour plus de quota) :
    - Mappe `tcg_product_id` → prix `market` depuis `cardmarket.prices.averageSellPrice` (Europe) ou `tcgplayer.prices`
    - Stocke un `collectible_price_snapshots` par sync
- `GET /api/v1/collectibles/performance` — liste toutes les cartes avec :
    - `purchase_price`, `current_price`, `gain_loss`, `gain_loss_pct`
    - Triable par `best_performers` ou `worst_performers`
- Cron job interne : sync automatique des prix toutes les 24h (node-cron)

---

## Intégration Revolut

```typescript
// backend/src/integrations/revolut/revolut.client.ts
// Utilise l'API Revolut Business ou Personal (Open Banking)
// OAuth2 PKCE flow — l'utilisateur autorise une fois, on stocke le refresh_token chiffré en base (AES-256-GCM)
// Endpoints utilisés :
//   GET /accounts → liste des comptes
//   GET /transactions?from=&to=&count=&cursor= → transactions paginées
// Déduplique les transactions via external_id = revolut transaction id
```

---

## Import CSV — format supportés

Crée un parser CSV intelligent dans `backend/src/integrations/csv/` :

```typescript
// Détecte automatiquement le format selon les headers
// Revolut : Date,Description,Amount,Fee,Currency,State,Balance
// Trade Republic : Date,Valeur,Montant,ISIN,Nom
// Caisse d'Épargne : Date de l'opération;Libellé;Débit;Crédit
// BNC : Date,Description,Débit,Crédit,Solde
// Normalise tout vers le format interne Transaction
// Déduplique via hash(date + amount + description) → external_id
```

---

## Frontend — UI/UX

### Design system
Couleurs principales (TailwindCSS custom theme) :
```
bg-base     : #0F1117  (fond principal — noir profond)
bg-surface  : #1A1D27  (cards, panels)
bg-elevated : #222536  (hover states, inputs)
accent      : #6366F1  (indigo — actions principales)
accent-2    : #10B981  (emerald — gains, positif)
accent-3    : #F43F5E  (rose — pertes, alertes)
text-primary: #F1F5F9
text-muted  : #64748B
border      : #2D3148
```

Typography :
- Display/titres : **Inter** (weights 600/700)
- Corps : **Inter** (weight 400/500)
- Chiffres/données : **JetBrains Mono** (monospace, pour alignement des montants)

### Layout global
```
┌─────────────────────────────────────────────────────┐
│  Sidebar (220px fixe)  │  Main content (flex-grow)  │
│  ─ Logo/Avatar         │  ─ Header (titre + actions)│
│  ─ Nav items           │  ─ Page content             │
│  ─ Net worth (bas)     │                             │
└─────────────────────────────────────────────────────┘
```

La sidebar affiche en bas le **patrimoine net total** en temps réel (comptes + investissements + crypto + collectibles − dettes).

### Pages et composants

**Dashboard (home)**
- Hero : grande carte "Patrimoine net total" avec sparkline 30j
- Row de KPIs : Solde total comptes / Épargne totale / Investissements / Crypto
- Graphique : évolution du patrimoine net sur 12 mois (AreaChart Recharts, gradient indigo)
- Budget du mois en cours : donut chart par catégorie
- Dernières transactions (5)
- Alerte jalons : badge animé si un jalon vient d'être franchi

**Comptes**
- Liste des comptes avec solde, institution, évolution 30j (sparkline mini)
- Bouton "Sync" par compte (Revolut) ou "Import CSV"
- Vue détail compte : graphique solde historique + liste transactions filtrables

**Transactions**
- Liste paginée avec filtres (compte, catégorie, période, type)
- Recherche full-text
- Ajout manuel (drawer latéral)
- Édition inline des catégories

**Budget**
- Vue mensuelle : barre de progression par catégorie (prévu vs réel)
- Vue annuelle : heatmap des dépenses par catégorie × mois
- Édition inline des montants planifiés

**Épargne & Objectifs**
- Cards par objectif avec :
    - Barre de progression circulaire animée
    - Jalons avec checkmarks (6 mois, 1 an)
    - Historique des dépôts (mini timeline)
- Bouton "Déposer" avec drawer

**Investissements**
- Résumé : total investi / valeur actuelle / performance globale %
- Graphique : AreaChart "Investi vs Valeur du portefeuille" depuis le début
- Simulateur DCA interactif :
    - Sliders : apport mensuel / taux annuel / durée
    - Graphique projection en temps réel (LineChart)
    - Jalons 20K/50K/100K/1M affichés sur le graphique avec des marqueurs verticaux
    - Date estimée d'atteinte de chaque jalon

**Crypto**
- Cards par wallet : platform, adresse tronquée, valeur totale USD/EUR
- Évolution historique (LineChart)
- Bouton sync par wallet

**Collectibles (Pokémon)**
- Grille de cartes avec image, nom, prix achat, prix actuel, variation %
- Badge coloré : vert si +%, rouge si −%
- Top performers (5 meilleures) / Flops (5 pires) : tableau dédié
- Graphique : valeur totale collection dans le temps
- Formulaire ajout carte : recherche par nom (autocomplete via TCG API) → pré-rempli image + set + numéro → saisie prix d'achat + condition

### Composants charts réutilisables à créer dans `frontend/src/components/charts/`
```
<AreaChartCard>    — AreaChart Recharts avec gradient, tooltip custom, responsive
<LineChartCard>    — LineChart multi-séries avec légende
<DonutChartCard>   — PieChart avec trou, légende externe
<SparklineChart>   — mini LineChart sans axes (inline dans une card)
<ProgressBar>      — barre de progression avec couleur dynamique et label
<CircularProgress> — SVG circulaire animé (pour objectifs épargne)
<MilestoneMarker>  — marqueur vertical sur un graphique avec label et date
```

Tous les tooltips Recharts sont en thème sombre, formatent les montants avec `Intl.NumberFormat`.

---

## Gestion d'état frontend

- **React Query (TanStack Query v5)** pour tout le data fetching/caching/refetch
- **Zustand** pour l'état UI global uniquement (sidebar ouverte/fermée, préférences locales, devise d'affichage)
- **Pas de Redux**. Pas de Context API pour les données métier.

Conventions React Query :
```typescript
// features/accounts/hooks/useAccounts.ts
export const useAccounts = () => useQuery({ queryKey: ['accounts'], queryFn: api.accounts.getAll })
export const useSyncAccount = () => useMutation({ mutationFn: api.accounts.sync, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts'] }) })
```

---

## Client API frontend

```typescript
// frontend/src/lib/api.ts
// axios instance avec baseURL = import.meta.env.VITE_API_URL
// Interceptor request : ajoute Authorization: Bearer <access_token> depuis localStorage
// Interceptor response : sur 401, appelle /auth/refresh silencieusement, retry la requête originale
// Sur échec refresh : redirect vers /login
```

---

## Configuration Electron

```typescript
// electron/main.ts
// 1. Spawn le backend Express comme processus enfant (child_process.spawn)
// 2. Attend que le backend réponde sur /api/v1/health avant d'ouvrir la BrowserWindow
// 3. BrowserWindow : width 1400, height 900, minWidth 1100, minHeight 700
// 4. En prod : charge le build Vite (dist/index.html)
// 5. En dev : charge http://localhost:5173
// 6. preload.ts : expose uniquement les APIs nécessaires via contextBridge, jamais nodeIntegration=true
// 7. Content Security Policy stricte dans les headers de la BrowserWindow
```

---

## Variables d'environnement

Crée un `.env.example` complet :

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/finance_dashboard

# Auth
JWT_SECRET=<min 64 chars random>
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# Encryption (pour tokens OAuth Revolut)
ENCRYPTION_KEY=<32 bytes hex>

# Revolut
REVOLUT_CLIENT_ID=
REVOLUT_CLIENT_SECRET=
REVOLUT_ENVIRONMENT=sandbox # ou production

# Crypto
ETHERSCAN_API_KEY=
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Pokemon TCG
POKEMON_TCG_API_KEY= # optionnel, augmente le quota

# App
NODE_ENV=development
PORT=3001
CORS_ORIGIN=http://localhost:5173
```

Valide toutes ces variables au démarrage dans `backend/src/config/env.ts` avec Zod. Le serveur **refuse de démarrer** si une variable critique est manquante.

---

## Conventions de code

- **TypeScript strict** (`"strict": true` dans tsconfig, `noUncheckedIndexedAccess: true`)
- **Aucun `any`** — utilise `unknown` et type guards si nécessaire
- Chaque controller ne fait que : valider l'input (via middleware), appeler le service, retourner la réponse. **Aucune logique métier dans les controllers.**
- Chaque service est **injectable** (classe avec constructeur) pour faciliter les tests
- **Gestion d'erreurs** : classe `AppError extends Error` avec `statusCode` et `isOperational`. Le middleware errorHandler distingue les erreurs opérationnelles des erreurs inattendues.
- **Réponses API uniformes** :
  ```typescript
  // Succès
  { success: true, data: T, meta?: PaginationMeta }
  // Erreur
  { success: false, error: { code: string, message: string, details?: unknown } }
  ```
- Tous les montants en base sont des **integers en centimes** (évite les flottants). Ex : 150.50€ = `15050` en base. La conversion est faite dans le service.
- Dates : **UTC partout** en base et dans l'API. La conversion locale est faite côté frontend.

---

## Scripts npm à créer

```json
// package.json racine (workspace)
{
  "scripts": {
    "dev": "concurrently \"npm run dev:backend\" \"npm run dev:frontend\" \"npm run dev:electron\"",
    "dev:backend": "cd backend && tsx watch src/server.ts",
    "dev:frontend": "cd frontend && vite",
    "dev:electron": "cd electron && wait-on http://localhost:3001/api/v1/health && electron .",
    "build": "npm run build:backend && npm run build:frontend && npm run build:electron",
    "db:migrate": "cd backend && drizzle-kit migrate",
    "db:studio": "cd backend && drizzle-kit studio",
    "test": "cd backend && vitest run",
    "package:mac": "electron-builder --mac"
  }
}
```

---

## Ordre de développement recommandé

1. **Setup monorepo** : workspaces npm, tsconfigs, ESLint/Prettier partagés
2. **Base de données** : schéma Drizzle complet + migration initiale
3. **Backend core** : Express app, middlewares (auth, error, validate, rate limit), module auth complet
4. **Module accounts + transactions** : CRUD + import CSV + sync Revolut
5. **Module budget** : logique budget + stats
6. **Module savings** : objectifs + jalons + calculs automatiques
7. **Module investments** : entrées DCA + algorithme projections
8. **Module crypto** : intégrations on-chain (Etherscan, Solana RPC, Crypto.com)
9. **Module collectibles** : intégration Pokémon TCG API + cron sync
10. **Frontend** : design system + layout + pages dans l'ordre du backend
11. **Electron shell** : intégration, packaging, CSP
12. **Tests** : couverture des services critiques (auth, budget, projections)

---

## Ce que tu dois produire en premier

Lance le développement en commençant par :

1. Initialiser la structure de monorepo complète avec tous les `package.json`, `tsconfig.json`, `.eslintrc`, `.prettierrc`
2. Créer le schéma Drizzle complet dans `backend/src/db/schema/`
3. Implémenter le module `auth` complet (register, login, refresh, logout) avec tests
4. Implémenter le module `accounts` avec CRUD et l'import CSV multi-format

À chaque étape, dis-moi ce que tu viens de créer et demande confirmation avant de passer à la suivante.