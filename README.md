# Nonante

Le jeu de la vraie vie pour les jeunes entrepreneurs : un arc de 90 jours qui démarre quand tu veux, des principes « si… alors… » construits pour ton objectif, chaque jour prouvé (caméra, minuteur, réveil, photo, capture, lien), et des stats de joueur à maxer. Web app installable (PWA), mobile d'abord.

Le cahier des charges est dans [`CLAUDE.md`](CLAUDE.md). Ce README explique comment installer, configurer et déployer, et note les choix faits en route.

## Ce qui est construit (V2)

| Domaine | Contenu |
|---|---|
| Arc | Départ libre (aujourd'hui, demain, lundi, une date à 60 jours max) ou départ collectif d'une escouade officielle ; arc n° 2, 3… à la suite |
| Objectif | Type, phrase, chiffre et unité, affiché en haut du tableau de bord |
| Principes | 37 gabarits sourcés (travail profond, grenouille, règle des 2 minutes, prospection…), proposés selon l'objectif et les points faibles, 100 % modifiables ; difficulté calculée par le serveur ; modification effective le lendemain |
| Preuves | Minuteur, pompes et squats comptés à la caméra, réveil à code, photo, capture, lien, déclaratif ; contrôles aléatoires |
| Jeu | XP, niveaux, titres, 6 stats sur 30 jours (Discipline, Focus, Corps, Business, Esprit, Énergie), note globale, séries, jokers, quête de la semaine, succès avec rareté réelle, fonds de carte à débloquer, avant / après, citation du jour |
| Portefeuille | Revenus notés avec capture en preuve, +15 XP par jour prouvé, succès 1 € → 10 000 €, suivi de l'objectif de revenu |
| Social | Classement semaine / général, filtres, onglet par escouade ; escouades privées (code) ou publiques ; profil public avec photo et carte de joueur |
| Parcours | Questionnaire sans compte (une question par écran, mots manuscrits), écran de construction (vrai calcul des principes), résultat personnalisé avec preuve sociale réelle et plans, email + code, dernière étape, paiement |
| Paiement | Arc 90 jours 19,99 € une fois par arc, Pro 14,99 €/mois ou 99,99 €/an, Fondateur 199 € une fois (100 places) ; portail client ; parrainage (−20 % pour l'ami et −20 % pour le parrain) ; fidélité (−50 % sur l'arc ou la facture suivante) |
| Contenu | FAQ (`/faq`), CGU, CGV, confidentialité, mentions légales |
| Admin | Double authentification, ventes, contrôles (preuves et revenus), signalements, escouades officielles, accès offerts, journal |

## Démarrer en local

Prérequis : Node.js 20.9 ou plus récent (sur ce Mac : `export PATH="$HOME/.local/node/bin:$PATH"`).

```bash
npm install
cp .env.example .env.local   # puis remplis les valeurs
npm run dev
```

`npm install` copie aussi les fichiers WebAssembly de MediaPipe dans `public/mediapipe`.

## Variables d'environnement

| Variable | Où la trouver | Sert à |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase > Project Settings > API | appels de l'utilisateur connecté (RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | idem (secrète) | serveur uniquement : webhook, crons, photos, portefeuille |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe > Developers | abonnements, portail, crédits de parrainage, coupons |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | idem | réservé (Checkout est une redirection) |
| `RESEND_API_KEY`, `EMAIL_FROM` | Resend (facultatif) | emails applicatifs ; sans clé, rien n'est envoyé hors connexion |
| `CRON_SECRET` | `openssl rand -hex 32` | protège `/api/cron/*`, clé HMAC de l'empreinte IP |
| `NEXT_PUBLIC_SITE_URL` | URL publique | liens des emails et retours Stripe |
| `NEXT_PUBLIC_GOOGLE_AUTH` | `1` une fois Google activé dans Supabase | bouton « Continuer avec Google » (connexion et questionnaire) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | `npx web-push generate-vapid-keys` | notifications push |
| `AUDIT_RATE` | `0.10` | part des preuves faibles contrôlées |

## Supabase

### Migrations

Dans l'ordre, depuis [`supabase/migrations/`](supabase/migrations/) (SQL Editor ou `npx supabase db push`) :

1. `20261007100000_v2_base.sql` : réglages, limitation de débit, fonctions utilitaires
2. `20261007100100_v2_schema.sql` : tables, RLS, buckets `proofs` (privé) et `avatars` (public)
3. `20261007100200_v2_logic.sql` : règles du jeu
4. `20261007100300_v2_read_admin_cron.sql` : lectures, escouades, paiements, admin, crons
5. `20261007100400_v2_seed.sql` : plans, gabarits, quêtes, succès, escouade officielle du 1er janvier

**Passage de la V1 à la V2** : exécuter d'abord [`supabase/ops/reset-v1.sql`](supabase/ops/reset-v1.sql), qui supprime le schéma V1 (données comprises). Les comptes Auth restent : il suffit de refaire l'onboarding.

### Réglages Auth

- URL Configuration : Site URL = domaine ; Redirect URLs `https://<domaine>/auth/callback` et `/auth/confirm`.
- Email OTP à 6 chiffres ; modèle Magic Link avec `{{ .Token }}` et un lien `/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/app`.
- **SMTP** : le serveur d'email intégré de Supabase est limité à quelques messages par heure. Avant le lancement, branche un SMTP (Project Settings > Authentication > SMTP Settings).

### Types

```bash
npm run db:types
```

## Stripe

1. `npm run stripe:setup` crée les produits Arc 90 jours, Pro, Fondateur, leurs prix (unique, mensuel, annuel), les coupons de parrainage et de fidélité et la configuration du portail, puis les enregistre dans `settings` (relançable).
2. Webhook vers `https://<domaine>/api/stripe/webhook`, événements : `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`.
3. En local : `stripe listen --forward-to localhost:3000/api/stripe/webhook`. Carte de test `4242 4242 4242 4242`.

## Vercel

[`vercel.json`](vercel.json) appelle `/api/cron/run` deux fois par jour (compatible plan Hobby). Routes cron (toutes protégées par `Authorization: Bearer $CRON_SECRET`, idempotentes) : `day-close`, `reminders`, `weekly`, `audits`, `cleanup`, `arc-end`, `run`.

## Créer un admin

Après ton onboarding :

```sql
update public.profiles set is_admin = true where pseudo = 'ton_pseudo';
```

Puis `/admin` : double authentification obligatoire (application d'authentification).

## Tester

| Commande | Ce qu'elle vérifie |
|---|---|
| `npm run test:db` | 198 tests sur Postgres 17 (PGlite) : Arc 90 jours (paiement unique, crédit, fin d'arc), aperçu des principes pour un visiteur, preuve sociale, démarrage libre, principes versionnés, difficulté serveur, chaque preuve, jokers, points, stats, niveaux, quêtes, portefeuille, escouades, classement, plans et limites, abonnements, parrainage, fidélité, RLS, registre en ajout seul, admin, suppression de compte |
| `npm run lint` / `npm run typecheck` / `npm run build` | ESLint, TypeScript strict, build |

Parcours joué à 375 px contre un Supabase émulé : questionnaire visiteur → construction → plans → email et code → dernière étape → paiement simulé → tableau de bord ; arc n° 2 d'un joueur connecté ; connexion, onboarding, génération des principes, plans, tableau de bord et calendrier, validation déclarative, capture, revenu prouvé, montée de niveau, succès, photo de profil, escouade, classement, profil public, quête, avant / après.

## Choix faits en route

1. **Pas de plan gratuit** : on construit son arc gratuitement (objectif, principes), puis on choisit un plan pour le lancer. Sans abonnement actif, plus rien ne se valide.
2. **Difficulté calculée par le serveur** à partir de la preuve et de la cible : impossible de se donner 30 points pour 5 pompes.
3. **Modifications de principes le lendemain** (versions `active_from` / `active_until`) : on ne change pas les règles d'un jour déjà commencé.
4. **Stats sur 30 jours glissants** : la note baisse si on arrête, elle se mérite en continu.
5. **Portefeuille** : un revenu sans capture est noté « non prouvé » et ne compte ni pour la stat ni pour les succès. Les revenus prouvés peuvent être contrôlés (refus = retrait des points).
6. **Photos** : CC0 / domaine public via l'API Openverse (`scripts/fetch-photos.mjs`), œuvres du domaine public via Wikimedia (`npm run art:fetch`), crédits sur `/art`. Les images Pinterest fournies n'ont pas été utilisées (droits d'auteur, visage d'une personne connue, marques, filigranes). Pour utiliser tes propres photos : dépose-les dans `public/art/` et ajoute-les à `lib/art.ts`.
7. **Droit de rétractation** : case à cocher obligatoire avant paiement pour l'accès immédiat ; formulaire type dans les CGV.
8. **Aucun chiffre inventé** : les exemples de la landing sont présentés comme exemples ; le compteur Fondateur et les statistiques viennent de la base. La preuve sociale n'affiche les chiffres en direct qu'au-delà de 20 joueurs (sinon seulement les études publiées), et aucun faux avis.
9. **Questionnaire avant le compte** : on demande l'email au moment où le visiteur a vu son arc et choisi son plan (effet d'investissement). Les réponses sont gardées côté serveur avec l'email, pour que le lien de connexion marche même ouvert dans un autre navigateur (TikTok → Safari), puis supprimées.
10. **Écran de construction** : il attend le vrai calcul des principes (preview_principles) et dure environ 5 secondes ; pas de faux compte à rebours ni de fausse rareté.

## Plus tard

- App iOS native avec Screen Time (blocage d'apps pendant les sessions), qui réutilisera les mêmes fonctions Postgres.
- Adhésion à un médiateur de la consommation et immatriculation (SIRET) avant les premières ventes réelles.
