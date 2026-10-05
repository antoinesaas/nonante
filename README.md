# Nonante

Web app installable (PWA, mobile d'abord) pour les étudiants-entrepreneurs : un arc de 90 jours, des principes imposés, rien ne se valide sans preuve.

Le cahier des charges complet est dans [`CLAUDE.md`](CLAUDE.md). Ce README explique comment installer, configurer et déployer l'app, et note les choix faits en route.

## Ce qui est construit

Les 10 phases du §16 :

| Phase | Contenu |
|---|---|
| 1 | Landing (stats réelles, compte à rebours, early bird), liste d'attente avec UTM, prévente sans compte |
| 2 | Connexion par lien magique et code à 6 chiffres, onboarding (une question par écran, œuvres en fond), principes imposés générés en base, PWA (manifest, icônes, service worker) |
| 3 | Pass d'arc (Stripe Checkout), rattachement des préventes, webhook idempotent, parrainage −20 %, fidélité −50 % |
| 4 | Tableau de bord, calendrier de 90 points, validations `declaratif`, `reveil`, `lien`, registre de points en ajout seul, clôture des jours |
| 5 | Minuteur de concentration (battements, rupture à 10 s hors écran, écran maintenu allumé) |
| 6 | Répétitions à la caméra (MediaPipe, sur l'appareil), photos prises dans l'app, contrôles aléatoires, file admin |
| 7 | Classement Arc / Semaine, profils publics et cartes de partage, succès avec rareté réelle, œuvres du domaine public |
| 8 | Épreuves de la semaine et pièges, niveaux, rappels push et email, récapitulatif du lundi, crons |
| 9 | Admin avec double authentification (ventes, cohortes et prix, contrôles, signalements, mises, journal), pages légales, sécurité du §14 |
| 10 | Mise sur soi derrière `FEATURE_STAKE` (désactivée) |

## Démarrer en local

Prérequis : Node.js 20.9 ou plus récent. Sur ce Mac, Node 22 est installé dans `~/.local/node`. Ajoute cette ligne à ton `~/.zshrc` pour l'avoir dans le terminal :

```bash
export PATH="$HOME/.local/node/bin:$PATH"
```

Puis :

```bash
npm install
cp .env.example .env.local   # puis remplis les valeurs
npm run dev
```

`npm install` copie aussi les fichiers WebAssembly de MediaPipe dans `public/mediapipe` (script `postinstall`).

## Variables d'environnement

Toutes sont listées dans [`.env.example`](.env.example).

| Variable | Où la trouver | Sert à |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase > Project Settings > API | lectures et appels de l'utilisateur connecté (RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | idem (clé secrète) | serveur uniquement : webhook, crons, photos, liste d'attente |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe > Developers | paiements, codes promo, remboursements de mise |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | idem | réservé (Checkout est une redirection, la clé publique n'est pas utilisée) |
| `RESEND_API_KEY`, `EMAIL_FROM` | Resend | emails (bienvenue, rappels, contrôles, récap, fidélité) |
| `CRON_SECRET` | `openssl rand -hex 32` | protège `/api/cron/*` ; clé HMAC de l'empreinte IP et des liens de désinscription |
| `NEXT_PUBLIC_SITE_URL` | URL publique | liens des emails et retours Stripe |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | `npx web-push generate-vapid-keys` | notifications push |
| `FEATURE_STAKE` | `false` | mise sur soi (à laisser désactivée, voir plus bas) |
| `DEFAULT_STAKE_CENTS` | `3000` | montant de la mise |
| `AUDIT_RATE` | `0.10` | part des preuves faibles contrôlées (recopiée en base à chaque passage du cron) |

## Supabase

### 1. Appliquer les migrations

Les migrations sont dans [`supabase/migrations/`](supabase/migrations/), à appliquer dans l'ordre (le nom commence par la date) :

- dashboard Supabase > SQL Editor : coller chaque fichier, dans l'ordre, et l'exécuter ;
- ou CLI : `npx supabase link --project-ref zkmaetegstjnyayhdqkb` puis `npx supabase db push`.

Elles créent tout : tables, RLS, fonctions du jeu, bucket privé `proofs`, contenu de départ (gabarits, 30 épreuves, succès, œuvres) et les deux cohortes (test et 1er janvier).

### 2. Réglages Auth (dashboard > Authentication)

- **URL Configuration** : Site URL = ton domaine ; ajoute `https://<ton-domaine>/auth/callback` et `https://<ton-domaine>/auth/confirm` aux Redirect URLs.
- **Email** : longueur du code OTP = 6.
- **Email Templates > Magic Link** : le lien doit marcher même s'il s'ouvre dans le navigateur de TikTok, et le code doit apparaître. Exemple de corps :

  ```html
  <p>Ton code Nonante : <strong>{{ .Token }}</strong></p>
  <p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/app">Ou clique ici pour te connecter</a></p>
  ```

- **SMTP** : l'envoi d'emails intégré de Supabase est limité à quelques messages par heure. En production, branche le SMTP de Resend (Project Settings > Authentication > SMTP Settings).
- **Multi-Factor** : TOTP activé (c'est le cas par défaut).

### 3. Vérifications

- Database > Advisors (Security et Performance) : je n'ai pas pu les lancer, car le connecteur Supabase de cette session n'avait pas accès au projet. À vérifier après les migrations.

### Types TypeScript

[`lib/database.types.ts`](lib/database.types.ts) est généré depuis les migrations, sans Docker ni connexion :

```bash
npm run db:types
```

## Stripe

En développement, utilise les clés de test (`sk_test_…`).

1. Coupons, produit et prix :

   ```bash
   npm run stripe:setup
   ```

   Le script crée les coupons de parrainage et de fidélité, le produit « Pass d'arc » et les deux prix de chaque cohorte. Il est relançable. Si tu changes un prix depuis l'admin, le paiement utilise quand même le bon montant (prix recalculé à la volée).

2. Webhooks en local avec la [CLI Stripe](https://docs.stripe.com/stripe-cli) :

   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

   Copie le secret `whsec_…` affiché dans `STRIPE_WEBHOOK_SECRET`.

3. Parcours complet : connexion, onboarding, paiement avec la carte de test `4242 4242 4242 4242`, retour sur `/app`.

En production, crée un endpoint webhook vers `https://<ton-domaine>/api/stripe/webhook` avec les événements `checkout.session.completed` et `checkout.session.async_payment_succeeded`.

## Déployer sur Vercel

1. Importe le dépôt GitHub dans Vercel (Next.js est détecté).
2. Renseigne toutes les variables d'environnement (Production et Preview), avec `NEXT_PUBLIC_SITE_URL` = domaine final et `CRON_SECRET` défini.
3. Déploie, puis crée l'endpoint webhook Stripe de production.
4. Crons : [`vercel.json`](vercel.json) appelle `/api/cron/run` deux fois par jour (compatible avec le plan Hobby). Les horaires sont en UTC : `5 23 * * *` donne 00 h 05 à Paris en hiver (01 h 05 en été) pour la clôture des jours, et `30 17 * * *` donne 18 h 30 en hiver (19 h 30 en été) pour les rappels. Sur le plan Pro, tu peux ajouter un passage horaire de `/api/cron/audits`.

Routes cron disponibles, toutes protégées par `Authorization: Bearer $CRON_SECRET` et idempotentes : `day-close`, `reminders`, `weekly`, `audits`, `cleanup`, `cohort-end`, et `run` (tout ce qui est dû).

## Créer un admin

1. Connecte-toi une fois sur le site et termine l'onboarding, pour que ton profil existe.
2. Dans Supabase > SQL Editor :

   ```sql
   update public.profiles set is_admin = true where pseudo = 'ton_pseudo';
   ```

3. Va sur `/admin` : la double authentification est obligatoire. Scanne le QR code avec une application d'authentification, entre le code. Ensuite, chaque visite de `/admin` demandera le code si la session n'est pas déjà en double authentification.

Les fonctions admin vérifient elles-mêmes `is_admin` et le niveau `aal2` du jeton, et chaque action est écrite dans `audit_log`.

## Tester

| Commande | Ce qu'elle vérifie |
|---|---|
| `npm run test:db` | 114 tests sur un Postgres 17 local (PGlite) : règles de points, clôture des jours, « jamais deux fois », jours blancs, abandon, sessions (battements, rupture, abandon), répétitions, réveil, liens, contrôles, épreuves, fin d'arc, RLS avec plusieurs comptes, registre impossible à modifier (même avec la clé service_role), admin et double authentification, suppression de compte |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript strict |
| `npm run build` | build de production |

J'ai aussi joué le parcours complet dans un navigateur (375 px) contre un Supabase local émulé : connexion par code, onboarding, principes, rattachement d'une prévente, tableau de bord, validation déclarative, contrôle déclenché, session de concentration cassée après 12 s hors de l'écran (−5 points), repli sans caméra pour les pompes, classement, profils, export RGPD, double authentification admin, refus d'un contrôle (−30 points et une preuve refusée), tâches planifiées.

## Ce qu'il te reste à faire

- **Appliquer les migrations** sur ton projet Supabase et faire les réglages Auth ci-dessus.
- **Clés** Stripe, Resend et VAPID dans Vercel ; `npm run stripe:setup` ; endpoint webhook.
- **Tester sur de vrais téléphones** (iPhone Safari et Android Chrome) : le comptage des pompes à la caméra et la prise de photo. Je n'ai pas pu le faire, car le navigateur intégré bloque la caméra.
- **Compléter les pages légales** : ton adresse, ton email de contact, le droit de rétractation et le médiateur de la consommation (blocs « À COMPLÉTER »). Je n'ai rien inventé.
- **Avant d'activer la mise sur soi** : vérifier le délai maximal de remboursement Stripe (les remboursements se font à la fin d'un arc de 90 jours) et faire valider les CGV par un professionnel.

## Choix faits en route

1. **Préventes sans compte.** Stripe collecte l'email ; la vente est enregistrée dans `presales`, puis rattachée automatiquement au compte créé avec le même email (au passage sur `/checkout`), sans second paiement.
2. **Activation au retour de Stripe.** `/app?paid=1&session_id=…` vérifie la session chez Stripe et active l'inscription tout de suite (même fonction idempotente que le webhook), pour ne pas faire attendre l'utilisateur.
3. **Difficulté 3 débloquée au niveau 2.** Les gabarits de difficulté 3 sont plafonnés à 2 au niveau 1, puis passent à 3 à la montée de niveau (§7 : « ce que débloque un niveau : des principes de difficulté 3 »). La valeur à venir est affichée (« 30 pts au niveau 2 »).
4. **Gabarits légèrement reformulés** : « S'il est 7 h » (et non « Si il »), « Si je sors du lit, alors 20 pompes » (l'heure n'est pas vérifiable), une variante squats pour ceux qui ne font pas encore de pompes, et la salle les lundis, mercredis et vendredis (un principe conditionnel ne peut pas être exigé tous les jours).
5. **Réveil** : le code se valide dans les 2 h 30 avant l'heure de lever (sinon, valider à minuit compterait comme se lever) et dans les 10 minutes après son affichage, 5 essais au maximum.
6. **Répétitions** : chaque répétition est envoyée en [début, fin] et doit durer entre 0,8 et 6 s ; le repos entre deux répétitions est permis.
7. **Photos envoyées au serveur** (et non par URL d'upload signée) : le serveur vérifie le vrai type, refuse au-delà de 3 Mo, ré-encode en 1600 px sans métadonnées EXIF ni GPS, puis dépose dans le bucket privé. Aucun fichier non vérifié n'arrive dans le stockage.
8. **Sessions après minuit** : une session commencée avant minuit compte pour son jour de départ ; la clôture de ce jour attend la fin de la session (jamais plus de 90 minutes).
9. **« Jamais deux fois »** : on compare avec l'occurrence précédente du même principe (pour un principe du week-end, samedi puis dimanche).
10. **Épreuves** : une par semaine de l'arc (du lundi au dimanche, jusqu'à 14 semaines touchées par 90 jours), tirée sans répétition dans la catégorie et le niveau ; un piège toutes les 4 semaines. Les sessions des principes comptent aussi pour les épreuves de sessions.
11. **Contrôle refusé** : la validation est rejetée, −3 × valeur, +1 preuve refusée, et un jour vert devient rouge. Pour une épreuve, le gain est annulé et l'échec appliqué.
12. **Rejoindre un arc en cours** : possible jusqu'à 6 jours après le départ (prix normal) ; les jours avant l'entrée ne comptent pas. La cohorte de test n'est jamais proposée par défaut (lien `/onboarding?cohorte=<id>`).
13. **Âge** : année de naissance (au moins 18 ans d'écart) et case « J'ai 18 ans ou plus ».
14. **Cookies de session `HttpOnly`** : toute l'authentification passe par le serveur (Server Actions, double authentification comprise), le navigateur n'a jamais besoin de lire la session.
15. **CSP stricte à nonce** : toutes les pages sont rendues à la demande. Seuls ajouts : `wasm-unsafe-eval` (MediaPipe) et l'empreinte d'un seul style en ligne (l'annonceur d'accessibilité de Next.js).
16. **Push sans SSRF** : les abonnements ne sont acceptés que vers les services de notification connus (Google, Mozilla, Apple, Microsoft).
17. **Emails envoyés une seule fois** grâce à la table `email_log`, même si un cron ou un webhook est rejoué.
18. **Statistiques** : « inscrits » = inscriptions payées + préventes pas encore rattachées (une personne = un email). Même chiffre sur la landing, le classement et l'admin.
19. **Suppression de compte** : profil, principes, preuves, points et photos supprimés ; les préventes restent en comptabilité, détachées du compte.
20. **Œuvres** : les 11 œuvres ont été téléchargées par `npm run art:fetch` et vérifiées « Public domain » sur Wikimedia Commons. Le script refuse tout fichier dont la licence n'est pas claire (il a écarté une version sous CC BY 4.0 de *Falaises de craie sur l'île de Rügen*).
21. **Mots** : aucune allusion à des lots ou des récompenses. Le classement ne rapporte que des points, des succès et des œuvres.
22. **`npm audit`** : aucune faille dans les dépendances de production. Il reste des alertes dans l'outillage de lint (`eslint-config-next`), sans correctif publié.

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | développement |
| `npm run build` / `npm run start` | production |
| `npm run test:db` | banc de test de la base |
| `npm run db:types` | types TypeScript depuis les migrations |
| `npm run stripe:setup` | coupons, produit et prix Stripe |
| `npm run art:fetch` | œuvres du domaine public (Wikimedia Commons) |
| `npm run icons` | icônes de la PWA |

## Plus tard : l'app iOS et le blocage d'apps

Hors V1, à ne pas construire maintenant :

- Le blocage d'apps nécessite une app iOS native (Swift) avec les frameworks Screen Time (FamilyControls, ManagedSettings, DeviceActivity), et une **autorisation de distribution à demander à Apple** pour l'entitlement `com.apple.developer.family-controls`.
- Pendant une session, les apps choisies seront bloquées. Les principes validés feront **gagner du temps d'écran** (par exemple 15 minutes de réseaux sociaux débloquées après une session de 50 minutes).
- L'app iOS réutilisera le même backend Supabase : toutes les règles sont déjà dans les fonctions Postgres (`start_proof_session`, `heartbeat`, `complete_session`, `validate_declaratif`, `my_dashboard`, etc.), appelables depuis n'importe quel client avec le jeton de l'utilisateur.
