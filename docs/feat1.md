# Prompt Claude Code — Tickets Notion + Refonte Design Finary

Tu vas traiter deux choses en parallèle : corriger les bugs et manques fonctionnels listés ci-dessous, et refondre entièrement le design visuel de l'app pour qu'il soit une réplique fidèle du style Finary. Commence par le design (car il impacte tous les composants), puis traite les tickets par priorité.

---

## PARTIE 1 — REFONTE DESIGN (priorité absolue)

### Référence visuelle : Finary

Le design actuel doit être entièrement revu pour correspondre au style Finary. Voici les specs extraites des screenshots fournis.

### Palette de couleurs (remplace le thème actuel)

```css
/* Fonds */
--color-bg-base:      #0A0A0F;   /* fond principal — noir quasi-pur */
--color-bg-surface:   #111118;   /* cards, panels principaux */
--color-bg-elevated:  #1A1A24;   /* hover, inputs, modals */
--color-bg-sidebar:   #0D0D14;   /* sidebar légèrement distincte */

/* Bordures */
--color-border:       #1E1E2E;   /* bordures subtiles */
--color-border-hover: #2A2A3E;

/* Texte */
--color-text-primary: #FFFFFF;
--color-text-secondary: #A0A0B8;
--color-text-muted:   #52526E;

/* Accents */
--color-accent-gold:  #C9A84C;   /* doré Finary — courbe principale du graphique */
--color-accent-green: #22C55E;   /* gains, positif */
--color-accent-red:   #EF4444;   /* pertes, négatif */
--color-accent-blue:  #6366F1;   /* actions primaires, CTA */

/* Tags / badges */
--color-badge-bg:     #1E1E2E;
--color-badge-text:   #A0A0B8;
```

### Typographie

```css
/* Conserver Inter mais revoir les scales */
--font-display:  'Inter', sans-serif;   /* weight 700, tracking -0.03em pour les grands chiffres */
--font-body:     'Inter', sans-serif;   /* weight 400/500 */
--font-mono:     'JetBrains Mono', monospace;  /* montants, pourcentages */

/* Scale */
--text-xs:    11px;
--text-sm:    13px;
--text-base:  14px;
--text-md:    16px;
--text-lg:    20px;
--text-xl:    28px;
--text-hero:  48px;  /* patrimoine net principal */
```

### Layout global — réplique exacte Finary

```
┌──────────────────────────────────────────────────────────────────┐
│  Sidebar (200px, bg #0D0D14, pas de bordure droite visible)      │
│  ─ Logo "finance" (petit, blanc, top-left, padding 24px)        │
│  ─ Nav items (icône 18px + label, padding 10px 16px)            │
│    • item actif : bg #1A1A24, texte blanc, barre gauche 2px gold│
│    • item inactif : texte #52526E, hover texte #A0A0B8          │
│  ─ Pas de section "Net worth" en bas de sidebar                  │
│  ─ Avatar utilisateur tout en bas (36px, initiales)              │
│                                                                  │
│  Zone principale (flex-grow, bg #0A0A0F)                        │
│  ─ Pas de header global — chaque page a son propre titre        │
│  ─ Sélecteur de période (1J 7J 1M 3M 6M YTD 1A TOUT)           │
│    → boutons pill, fond transparent, actif fond #1A1A24 +       │
│      texte blanc, inactif texte #52526E                          │
└──────────────────────────────────────────────────────────────────┘
```

### Navigation sidebar — items et icônes

```
Synthèse       →  icône grid 2×2
Patrimoine     →  icône bar chart
Objectifs      →  icône target/cercle
Analyse        →  icône pie chart
Budget         →  icône document/liste
Investir       →  icône building/banque
Crypto         →  icône bitcoin/hexagone
Collectibles   →  icône carte/collection
Paramètres     →  icône engrenage (en bas, au-dessus avatar)
```

### Graphique principal (AreaChart) — style Finary

```
- Fond du container : bg #111118, border-radius 12px, padding 24px
- Courbe : stroke #C9A84C (doré), strokeWidth 1.5px, pas de points
- Aire sous la courbe : gradient vertical de rgba(201,168,76,0.15) → rgba(201,168,76,0)
- Axes : texte #52526E, text-xs, pas de ligne de grille visible (gridLine opacity 0)
- Tooltip : bg #1A1A24, border 1px solid #2A2A3E, border-radius 8px,
            texte primaire blanc, texte secondaire #A0A0B8
- En haut à gauche du container : date courante (text-sm, #A0A0B8) + montant (text-hero, blanc bold)
- En haut à droite : sélecteur de période pill
- Pas de légende sous le graphique
```

### Cards patrimoine / KPIs

```
- bg #111118, border 1px solid #1E1E2E, border-radius 12px
- Titre : text-sm, #A0A0B8, weight 400
- Valeur : text-xl ou text-hero selon importance, blanc, weight 700, font-mono
- Variation : text-sm, vert (#22C55E) si positif avec "▲", rouge (#EF4444) si négatif avec "▼"
  → format exact Finary : "+68 € ▲ 3,59%"
- Pas de shadow — l'élévation est donnée uniquement par la bordure
```

### Tableau d'actifs (page Patrimoine) — réplique exacte

```
Colonnes : Nom | Type | Répartition | Déten. | Valeur | +/- value | Var. YTD
- Header : text-xs, #52526E, weight 500, icônes de tri ↑↓ grises
- Ligne Total : texte blanc, valeurs gain en vert, pas de séparateur spécial
- Ligne actif :
  → Avatar 32px (initiales colorées ou logo institution)
  → Nom : text-sm blanc, weight 500
  → Institution : text-xs #52526E, sous le nom
  → Badge type : bg #1A1A24, text-xs #A0A0B8, border-radius 4px, padding 2px 8px
  → Répartition : mini progress bar circulaire (donut 20px) + pourcentage text-sm
  → Valeur : text-sm blanc, font-mono, weight 600
  → +/- value : text-sm vert/rouge, weight 500 + pourcentage en dessous plus petit
  → Var YTD : idem
  → "..." menu contextuel au hover, tout à droite
- Séparateur entre lignes : border-bottom 1px solid #1E1E2E opacity 0.5
- Hover ligne : bg #111118 → #1A1A24 (transition 150ms)
```

### Cards performance (scroll horizontal) — style Finary

```
- Rangée de cards scrollable horizontalement (pas de scrollbar visible)
- Card : bg #111118, border 1px solid #1E1E2E, border-radius 10px, padding 16px, width 200px
- En-tête card : logo/avatar 28px + nom actif (text-sm blanc) + badge #N (text-xs #52526E) à droite
- Sous-titre : ticker ou ISIN, text-xs #52526E
- Valeur : text-lg blanc bold, font-mono
- Variation : "+176 € +116,26 %" text-xs vert, deux valeurs sur même ligne
- Sparkline mini en bas à droite : LineChart 60×30px, stroke vert (#22C55E), pas d'axes
```

### Donut chart (répartition) — style Finary

```
- Pas de légende interne — la légende est la liste à droite
- Centre du donut : valeur totale en text-lg blanc + label "Total" text-xs #52526E
- Segments : couleurs variées (utiliser une palette de 8-10 couleurs distinctes et lisibles sur fond noir)
- Épaisseur du donut : 20% du rayon (donut épais)
- Pas d'animation au hover (ou très subtile — légère mise en avant du segment)
- Liste à droite : nom actif (text-sm blanc) + mini barre colorée (4px height, 32px width) + % (text-sm #A0A0B8, font-mono)
```

### Sidebar nav — item actif

```css
.nav-item.active {
  background: #1A1A24;
  border-left: 2px solid #C9A84C;  /* barre dorée à gauche */
  color: #FFFFFF;
  border-radius: 0 8px 8px 0;
  margin-left: -2px;  /* compenser la barre */
}
.nav-item:not(.active) {
  color: #52526E;
  border-left: 2px solid transparent;
}
.nav-item:hover:not(.active) {
  color: #A0A0B8;
  background: #111118;
}
```

### Badges et tags

```
- Type de compte : pill compact, bg #1A1A24, texte #A0A0B8, text-xs, border-radius 4px
- Badge "NOUVEAU" : bg #22C55E/20, texte #22C55E, text-xs
- Variation positive : texte #22C55E, "▲" prefix
- Variation négative : texte #EF4444, "▼" prefix
```

---

## PARTIE 2 — TICKETS NOTION (par priorité)

### 🔴 Priorité critique (bloquant l'usage)

**[BUG-01] Écran noir au démarrage**
L'app reste sur écran noir au lancement en dev et nécessite une fermeture/relance.
- Investiguer la séquence de démarrage Electron : le `BrowserWindow` s'ouvre avant que Vite soit prêt ou avant que le backend réponde sur `/health`
- Ajouter un `wait-on` explicite sur `http://localhost:5173` ET `http://localhost:3001/api/v1/health` avant d'ouvrir la fenêtre
- Ajouter un écran de chargement HTML inline dans `electron/main.ts` affiché pendant l'attente (fond #0A0A0F, logo centré, spinner discret)
- Logger dans la console Electron les étapes de démarrage pour faciliter le debug futur

**[BUG-02] Pas possible d'éditer les collectibles**
- Vérifier que la route `PUT /api/v1/collectibles/:id` existe et est câblée correctement
- Vérifier que le formulaire d'édition est bien présent dans le frontend (drawer ou modal)
- Si absent : créer le drawer d'édition (réutiliser le formulaire d'ajout en mode "edit", pré-rempli)
- Tester que les changements sont bien persistés en base

**[BUG-03] Recherche de carte (singles) ne fonctionne pas**
- Déboguer l'appel `GET /api/v1/collectibles/search/card?q=` → vérifier que l'intégration TCGdex retourne bien des résultats
- Vérifier que l'autocomplete frontend est bien branché sur cet endpoint (debounce 300ms, min 2 caractères)
- Tester avec plusieurs noms (charizard, pikachu) et logger les réponses TCGdex
- Si le SDK `@tcgdex/sdk` pose problème, fallback en fetch direct sur `https://api.tcgdex.net/v2/fr/cards?name=:q`

**[BUG-04] Pas possible d'éditer l'épargne**
- Vérifier que `PUT /api/v1/savings/:id` est bien implémenté
- Ajouter bouton d'édition sur chaque card objectif d'épargne
- Le drawer d'édition doit permettre de modifier : nom, montant cible, deadline, couleur, icône

**[BUG-05] Pas possible d'éditer les comptes crypto / pas de détails portefeuille**
- Implémenter `PUT /api/v1/crypto/wallets/:id` si manquant
- Créer une page détail wallet : liste des tokens détenus, valeur en EUR/USD, variation 24h
    - Pour ETH/MetaMask : utiliser Etherscan `tokenbalance` endpoint pour lister les tokens ERC-20
    - Pour Solana/Photon : `getTokenAccountsByOwner` pour lister les SPL tokens
    - Pour Crypto.com : endpoint balances de l'API Exchange
- Afficher dans le détail : tableau de tokens (nom, symbol, quantité, valeur unitaire, valeur totale, variation)

---

### 🟠 Priorité haute (fonctionnalités manquantes importantes)

**[FEAT-01] Catégories de base en dépenses + création libre**
- Créer un seed de catégories par défaut dans `backend/src/db/seeds/categories.ts` :
  ```
  Logement (loyer, charges, assurance habitation)
  Alimentation (courses, épicerie)
  Restauration (restaurant, livraison, café)
  Transport (carburant, transports en commun, parking)
  Abonnements (streaming, téléphone, internet, logiciels)
  Santé (médecin, pharmacie, mutuelle)
  Loisirs (cinéma, sport, jeux)
  Vêtements
  Épargne (virements épargne)
  Revenus (salaire, freelance, remboursements)
  Autres
  ```
- Ces catégories sont créées automatiquement à l'inscription (`is_default: true`)
- L'utilisateur peut en créer de nouvelles librement (couleur + icône + nom)
- Les catégories par défaut ne sont pas supprimables, les custom oui

**[FEAT-02] Bouton de création de budget manquant**
- Ajouter un bouton "Créer le budget de [mois en cours]" sur la page Budget si aucun budget n'existe pour le mois
- Si un budget du mois précédent existe : proposer "Copier le budget de [mois précédent]" ou "Créer un nouveau budget vierge"
- Le bouton doit être visible et centré sur la page quand la liste est vide (empty state)

**[FEAT-03] "Se souvenir de moi" à la connexion**
- Ajouter une checkbox "Se souvenir de moi" sur le formulaire de login
- Si coché : refresh token expire dans 30 jours (au lieu de 7)
- Si non coché : refresh token expire à la fermeture de session (sessionStorage au lieu de cookie persistant)
- Stocker la préférence côté backend dans `refresh_tokens.remember_me BOOLEAN`

**[FEAT-04] Clés API dans les Settings (pas dans le .env)**
- Créer une table `app_settings` en base :
  ```sql
  app_settings → id, user_id, key (TEXT UNIQUE), value_encrypted (TEXT), updated_at
  ```
  Les valeurs sensibles sont chiffrées en AES-256-GCM avant stockage (réutilise l'utilitaire déjà en place pour Revolut)
- Créer les endpoints `GET|PUT /api/v1/settings` (retourne les clés sans déchiffrer les valeurs, juste un booléen "configuré")
- Page Settings dans le frontend, section "Intégrations" :
    - Etherscan API Key
    - Crypto.com API Key + Secret
    - PokemonPriceTracker API Key
    - Poketrace API Key
    - Revolut Client ID + Secret
    - Chaque champ : input masqué (type password) + bouton "Tester" + badge "Configuré ✓" si présent
- Supprimer toutes ces valeurs du `.env` (ne garder que `DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`, `PORT`)

**[FEAT-05] Compte en euros ET en dollars (taux de change quotidien)**
- Ajouter un champ `display_currency: 'EUR' | 'USD' | 'CAD'` dans les préférences utilisateur
- Intégrer un service de taux de change gratuit : **ExchangeRate-API** (1500 req/mois gratuit) ou **Frankfurter API** (gratuit, no key)
  ```
  GET https://api.frankfurter.app/latest?from=EUR&to=USD,CAD
  ```
- Mettre à jour les taux une fois par jour via un cron job (stocker en table `exchange_rates`)
- Tous les montants affichés dans le frontend respectent la devise de l'utilisateur
- Ajouter un sélecteur de devise dans le header ou les Settings

**[FEAT-06] Gamifier l'atteinte des jalons**
- Quand un jalon est franchi (épargne ou investissement), afficher :
    - Une animation de confettis (librairie `canvas-confetti`, légère)
    - Un toast/notification plein écran pendant 3 secondes : "🎉 Jalon atteint — 20 000 € investis !" avec la date
    - Le jalon passe à l'état "atteint" avec une checkmark animée et la date d'atteinte
- Ajouter un tableau des jalons sur la page Investissements et Épargne :
    - Jalons atteints : badge vert + date + "✓"
    - Prochain jalon : barre de progression + montant manquant + estimation de date

**[FEAT-07] Module Crédits**
Nouveau module à créer : `backend/src/modules/credits/`

Schema DB :
```sql
credits → id, user_id, name, institution, initial_amount, remaining_amount,
          monthly_payment, interest_rate, start_date, end_date,
          early_repayment_fee_rate, currency
credit_payments → id, credit_id, date, amount, principal_part, interest_part
```

Endpoints :
```
GET|POST   /api/v1/credits
GET|PUT|DELETE /api/v1/credits/:id
GET        /api/v1/credits/:id/simulation
           → Params: early_repayment_date
           → Retourne:
             - total_remaining: montant restant à rembourser
             - interest_saved: intérêts économisés
             - early_repayment_fee: frais de remboursement anticipé
             - net_gain: économie nette (interest_saved - fee)
             - freed_monthly_budget: mensualités libérées
             - investment_projection: si freed_monthly_budget investi en DCA à 7%/an sur N années → valeur projetée
```

Page frontend Crédits :
- Liste des crédits actifs : nom, institution, mensualité, capital restant, taux, date de fin
- Barre de progression remboursement (capital remboursé / capital initial)
- Simulateur de remboursement anticipé :
    - Sélecteur de date de remboursement
    - Résultat : intérêts économisés / frais / gain net / mensualités libérées
    - Comparaison : "Si vous investissez ces X€/mois en DCA → valeur projetée à N ans"
    - Graphique LineChart : scénario "remboursement anticipé + investissement" vs "ne rien faire"

---

### 🟡 Priorité normale (améliorations)

**[FEAT-08] API ETF et actions (cours en temps réel)**
- Intégrer **Alpha Vantage** (gratuit, 25 req/jour) ou **Yahoo Finance** (non officielle mais stable) pour les cours d'ETF/actions
- Recommandé : **Alpha Vantage** (clé API gratuite, stockée dans Settings)
  ```
  GET https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=IWDA.AS&apikey=KEY
  ```
- Ajouter dans `investment_entries` un champ `ticker` optionnel
- Sync automatique des cours 1x/jour (cron) si ticker renseigné
- Configurable via Settings (clé Alpha Vantage)

**[FEAT-09] Compte démo avec jeu de données complet**
- Créer un script `backend/src/db/seeds/demo.ts` qui génère un utilisateur démo complet :
  ```
  Email: demo@finance.app / Password: demo123
  Comptes : Caisse d'Épargne (2 450€), Revolut (890€), Trade Republic (8 200€)
  Transactions : 18 mois d'historique, toutes catégories
  Budget : configuré pour le mois en cours
  Épargne : 2 objectifs (précaution 6 mois à 45%, projet voyage à 72%)
  Investissements : 24 mois de DCA, jalons 20K atteint
  Crypto : 1 wallet ETH, 1 wallet Solana
  Collectibles : 8 cartes singles + 3 produits scellés
  Crédit : 1 crédit immobilier en cours
  ```
- Bouton "Accéder au compte démo" sur l'écran de login (sans mot de passe requis)
- Le compte démo est en lecture seule : toutes les mutations retournent 403 avec message "Mode démo — compte en lecture seule"

**[FEAT-10] Autres exchanges crypto (Binance, Bybit…)**
- Étendre le enum `platform` de `crypto_wallets` : ajouter `binance`, `bybit`, `coinbase`, `kraken`
- Implémenter les providers correspondants dans `backend/src/integrations/crypto/` :
    - **Binance** : API publique `GET /api/v3/account` (clé lecture seule)
    - **Bybit** : API v5 `GET /v5/account/wallet-balance`
    - Stocker les clés API dans `app_settings` (via le système Settings du FEAT-04)
- Ajouter les nouveaux exchanges dans les Settings (section "Exchanges crypto")

**[FEAT-11] Autres TCG via l'API**
- TCGdex supporte nativement : Pokémon, One Piece, Dragon Ball, Digimon, Star Wars Unlimited, Lorcana
- Étendre `collectible_items` :
    - Ajouter `tcg_type: 'pokemon' | 'onepiece' | 'dragonball' | 'digimon' | 'lorcana' | 'starwars'`
    - L'autocomplete de recherche de cartes utilise le bon endpoint TCGdex selon le `tcg_type`
- Dans le formulaire d'ajout de carte : dropdown "Jeu" en premier → adapte la recherche

**[FEAT-12] Module SCPI / Immobilier**
Nouveau module `backend/src/modules/real-estate/`

```sql
real_estate_assets → id, user_id, name, type (physical|scpi|crowdfunding),
                     platform,         -- null si physique, 'brick' | 'mapremierebrique' | autre si crowdfunding
                     purchase_price, current_value, purchase_date,
                     monthly_income,   -- loyers / dividendes SCPI
                     surface_m2,       -- si physique
                     location,         -- si physique
                     notes
```

- CRUD complet
- Page Immobilier : valeur totale, rendement brut (revenus annuels / valeur), historique valeur
- Intégration prix SCPI : saisie manuelle (les SCPI publient les prix 1-2x/an)

**[FEAT-13] Ajouter les montres comme actif**
- Étendre le module collectibles avec `item_type: 'watch'`
- Champs spécifiques : marque, modèle, référence, année, état
- Prix : saisie manuelle (pas d'API publique stable pour les montres)
- Si tu trouves une API fiable (Chrono24 n'a pas d'API publique), intégrer, sinon rester en manuel

---

### ⚪ Priorité basse (backlog)

**[FEAT-14] Scrappeur prix scellés**
→ Dépriorisé, à traiter dans une phase ultérieure si le mode manuel est insuffisant.

---

## PARTIE 3 — ORDRE D'EXÉCUTION RECOMMANDÉ

1. **Refonte design complète** (PARTIE 1) — impacte tous les composants, à faire en premier
2. **BUG-01** Écran noir au démarrage
3. **BUG-02 + BUG-03** Collectibles (édition + recherche carte)
4. **BUG-04 + BUG-05** Épargne et Crypto (édition + détails)
5. **FEAT-01** Catégories par défaut
6. **FEAT-02** Bouton création budget
7. **FEAT-03** Se souvenir de moi
8. **FEAT-04** Clés API dans Settings (débloque FEAT-08 et FEAT-10)
9. **FEAT-05** Multi-devise (EUR/USD/CAD)
10. **FEAT-06** Gamification jalons
11. **FEAT-07** Module Crédits
12. Puis les priorités normales dans l'ordre listé

---

## CONSIGNES GÉNÉRALES

- Pour chaque ticket traité, dis-moi ce que tu as fait et montre-moi le résultat avant de passer au suivant
- Le design Finary est la référence absolue : si un composant existant ne correspond pas aux specs ci-dessus, le refaire entièrement
- Les couleurs, espacements et typographies définis en PARTIE 1 s'appliquent à **toute** l'app, sans exception
- Aucune couleur ne doit être hardcodée dans les composants — tout passe par les CSS variables
- Commence par la PARTIE 1 (design) et montre-moi le résultat du dashboard avant de passer aux tickets