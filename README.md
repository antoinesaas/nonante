# Nonante

Web app (PWA, mobile d'abord) pour les étudiants-entrepreneurs : un arc de 90 jours, des principes imposés, rien ne se valide sans preuve.

Le cahier des charges complet est dans [`CLAUDE.md`](CLAUDE.md). Ce README suit l'avancement et note les choix techniques faits en route.

## Avancement

| Phase | Contenu | État |
|---|---|---|
| 1 | Landing, liste d'attente, prévente | **Faite** |
| 2 | Auth, onboarding, génération des principes, PWA | À faire |
| 3 | Paiement avec compte, webhook, parrainage, fidélité | À faire |
| 4 | Tableau de bord, calendrier, validations `declaratif` / `reveil` / `lien`, registre de points, cron `day-close` | À faire |
| 5 | Minuteur de concentration | À faire |
| 6 | Caméra (répétitions, photos), contrôles aléatoires, file admin | À faire |
| 7 | Classement, profils publics, succès, œuvres | À faire |
| 8 | Épreuves, niveaux, rappels, crons restants | À faire |
| 9 | Admin complet, pages légales, passe de sécurité | À faire |
| 10 | Mise sur soi (désactivée) | À faire |

### Ce que contient la phase 1

- `/` : promesse, prochain arc ouvert, compte à rebours jusqu'au départ (minuit, heure de Paris), nombre réel d'inscrits, prix early bird, bouton « Rejoindre l'arc » vers Stripe Checkout, rappel par email pour les indécis. S'il n'y a aucun arc ouvert : liste d'attente.
- `/merci` : retour de Stripe. Le statut est relu chez Stripe, jamais déduit de l'URL.
- `/api/stripe/webhook` : enregistre la prévente et envoie l'email de confirmation.
- `/legal/cgv`, `/legal/confidentialite`, `/legal/mentions` : gabarits marqués « À COMPLÉTER ».
- Capture de `utm_source` et `utm_campaign` dans un cookie de 30 jours, enregistrés avec chaque inscription et chaque vente.

## Démarrer en local

Prérequis : Node.js 20.9 ou plus récent. Sur ce Mac, Node 22 est installé dans `~/.local/node`. Ajoute cette ligne à ton `~/.zshrc` pour l'avoir dans le terminal :

```bash
export PATH="$HOME/.local/node/bin:$PATH"
```

Ensuite :

```bash
npm install
cp .env.example .env.local   # puis remplis les valeurs
npm run dev
```

L'app tourne sur http://localhost:3000.

## Variables d'environnement

Toutes sont listées dans [`.env.example`](.env.example). En phase 1, seules celles-ci servent :

| Variable | Où la trouver | Utilisée par |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase > Project Settings > API | tout |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | idem (clé `anon` / publishable) | lecture publique (cohortes, nombre d'inscrits) |
| `SUPABASE_SERVICE_ROLE_KEY` | idem (clé `service_role` / secret) | écritures serveur : liste d'attente, préventes, limitation de débit |
| `STRIPE_SECRET_KEY` | Stripe > Developers > API keys | création du paiement |
| `STRIPE_WEBHOOK_SECRET` | `stripe listen` en local, endpoint du dashboard en production | vérification du webhook |
| `RESEND_API_KEY`, `EMAIL_FROM` | Resend | email de confirmation (sinon ignoré, sans bloquer le paiement) |
| `CRON_SECRET` | `openssl rand -hex 32` | clé HMAC de l'empreinte IP (et des crons plus tard) |
| `NEXT_PUBLIC_SITE_URL` | URL publique du site | liens de retour Stripe, emails |

Sans clés Stripe, le bouton de paiement affiche « Le paiement n'est pas encore disponible ». Sans clé `service_role`, la liste d'attente affiche un message équivalent.

## Base de données

Les migrations sont dans [`supabase/migrations/`](supabase/migrations/), à appliquer dans l'ordre :

1. `20261005120000_phase1_landing.sql` : tables `cohorts`, `waitlist`, `presales`, `stripe_events`, `rate_limits`, fonctions `rate_limit_hit` et `cohort_signups`.
2. `20261005120100_phase1_seed_cohorts.sql` : la cohorte de test (départ le jour où la migration est appliquée) et l'Arc du 1er janvier 2027.

Deux façons de les appliquer :

- dashboard Supabase > SQL Editor : coller chaque fichier et l'exécuter ;
- CLI : `npx supabase link --project-ref zkmaetegstjnyayhdqkb` puis `npx supabase db push`.

RLS est activée sur toutes les tables. Le public ne peut lire que les colonnes publiques des cohortes et appeler `cohort_signups`. Tout le reste passe par le serveur.

### Types de la base

[`lib/database.types.ts`](lib/database.types.ts) suit le format de la CLI Supabase. Après chaque migration, régénère-le :

```bash
npx supabase gen types typescript --project-id zkmaetegstjnyayhdqkb > lib/database.types.ts
```

## Stripe

En développement, utilise les clés de test (`sk_test_…`).

1. Crée le produit et les prix à partir des montants en base :

   ```bash
   npm run stripe:setup
   ```

   Le script est relançable : il ne recrée un prix que s'il manque ou si le montant en base a changé. Si tu changes un prix en base sans relancer le script, le paiement utilise quand même le bon montant (prix calculé à la volée).

2. Reçois les webhooks en local avec la [CLI Stripe](https://docs.stripe.com/stripe-cli) :

   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

   Copie le secret `whsec_…` affiché dans `STRIPE_WEBHOOK_SECRET`.

3. Teste un vrai parcours : clique sur « Rejoindre l'arc » et paie avec la carte de test `4242 4242 4242 4242`. La prévente apparaît dans la table `presales`.

En production, crée un endpoint webhook vers `https://<ton-domaine>/api/stripe/webhook` avec les événements `checkout.session.completed` et `checkout.session.async_payment_succeeded`.

## Déployer sur Vercel

1. Importe le dépôt GitHub dans Vercel (framework détecté : Next.js).
2. Renseigne les variables d'environnement (Production et Preview), avec `NEXT_PUBLIC_SITE_URL` égal au domaine final.
3. Déploie, puis crée l'endpoint webhook Stripe de production (voir plus haut).
4. Vérifie la landing sur un téléphone, puis fais un paiement de test.

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de développement |
| `npm run build` / `npm run start` | build et serveur de production |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript strict |
| `npm run stripe:setup` | produit et prix Stripe à partir de la base |

## Sécurité en place (phase 1)

- Content-Security-Policy avec nonce par requête (`proxy.ts`), HSTS, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` (caméra coupée partout pour l'instant).
- Montants lus en base, jamais envoyés par le client. Webhook : signature vérifiée, chaque événement traité une seule fois (table `stripe_events` et contrainte `unique` sur la session Checkout).
- Zod sur toutes les entrées. Champ piège anti-robots, adresses jetables refusées, même réponse pour un email nouveau ou déjà inscrit.
- Limitation de débit en base : 5 inscriptions par heure et 10 paiements par 10 minutes par appelant. L'IP n'est jamais stockée, seulement son empreinte HMAC.
- Clé `service_role` utilisée uniquement dans des modules `server-only`. Aucune donnée personnelle dans les journaux.
- Dépendances épinglées, lockfile commité, Dependabot activé (`.github/dependabot.yml`).

## Choix faits en route

1. **Préventes sans compte.** L'authentification arrive en phase 2, mais la phase 1 doit déjà vendre. Stripe collecte l'email au paiement, et la vente est enregistrée dans une table `presales` (ajoutée au modèle du §8). En phase 3, une prévente sera rattachée au compte créé avec le même email (`claimed_by`) et l'inscription deviendra active sans second paiement. Le retour de paiement se fait sur `/merci` tant que `/app` n'existe pas.
2. **Prix.** Si la cohorte a un prix Stripe dont le montant correspond à la base, il est utilisé. Sinon, le prix est calculé à la volée à partir de la base. Ça garantit « prix modifiables sans redéployer », même avant d'avoir lancé `stripe:setup`.
3. **Cohorte affichée sur la landing.** C'est le prochain arc ouvert (`enroll_open`) qui n'a pas encore démarré, en date de Paris. La cohorte de test démarre aujourd'hui : elle n'est donc pas vendue sur la landing et servira aux tests des phases suivantes.
4. **`end_date` calculée.** Colonne générée `start_date + 89`, impossible à désynchroniser.
5. **Nombre d'inscrits.** `cohort_signups` compte les emails distincts des préventes non remboursées. La fonction sera étendue aux inscriptions en phase 3. Avec 0 inscrit, la landing affiche « Aucun inscrit pour l'instant. »
6. **Limitation de débit.** Fenêtre fixe dans Postgres (`rate_limits`), sans dépendance externe. `CRON_SECRET` sert de clé HMAC pour l'empreinte IP, afin de ne pas ajouter de variable au §15.
7. **CSP à nonce.** Elle impose un rendu dynamique : le layout racine appelle `connection()`, donc aucune page n'est statique. Pas de souci à cette échelle.
8. **Palette fermée.** `globals.css` supprime toutes les couleurs Tailwind par défaut : seules les 7 couleurs de la marque existent, et le vert et le rouge ne servent qu'aux états des jours.
9. **« 1er » en exposant.** En Instrument Serif, « 1er » se lit « ler ». Le composant `Ordinals` affiche 1ᵉʳ dans les titres.
10. **Pages légales dès la phase 1.** On encaisse de l'argent dès la phase 1, donc les gabarits existent déjà, clairement marqués « À COMPLÉTER ». Aucune mention légale n'a été inventée.
11. **Cookie UTM.** Cookie first-party `HttpOnly`, 30 jours, sans bannière. Il faut vérifier qu'il entre dans les exemptions de consentement de la CNIL (c'est noté dans la page Confidentialité).
12. **`npm audit`.** Aucune faille dans les dépendances de production (`npm audit --omit=dev`). Il reste 5 alertes « high » dans l'outillage de lint (`eslint-config-next` → `braces`), sans correctif sauf à rétrograder Next.js. Ce code ne part pas en production.
13. **Règles du jeu.** Les constantes de points du §6 sont déjà dans [`lib/rules.ts`](lib/rules.ts), prêtes pour la phase 4.

## Créer un admin avec double authentification

À venir en phase 9 (`/admin`, TOTP obligatoire).

## Plus tard : l'app iOS et le blocage d'apps

Hors V1, à ne pas construire maintenant :

- Le blocage d'apps nécessite une app iOS native (Swift) avec les frameworks Screen Time (FamilyControls, ManagedSettings, DeviceActivity), et une **autorisation de distribution à demander à Apple** pour l'entitlement `com.apple.developer.family-controls`.
- Pendant une session, les apps choisies seront bloquées. Les principes validés feront **gagner du temps d'écran** (par exemple 15 minutes de réseaux sociaux débloquées après une session de 50 minutes).
- L'app iOS réutilisera le même backend Supabase. L'API doit donc rester propre et documentée.
