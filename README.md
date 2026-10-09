# Nonante

« 90 jours. Zéro excuse. » Pour les étudiants et les entrepreneurs : un arc de 90 jours qui démarre quand tu veux, des principes « si… alors… » construits pour ton objectif, chaque jour prouvé (caméra, minuteur, réveil, photo, capture, lien), et des stats de joueur à maxer. Web app installable (PWA), mobile d'abord.

Le cahier des charges est dans [`CLAUDE.md`](CLAUDE.md). Ce README explique comment installer, configurer et déployer, et note les choix faits en route.

## Ce qui est construit (V2 à V5)

| Domaine | Contenu |
|---|---|
| Arc | Départ libre (aujourd'hui, demain, lundi, une date à 60 jours max) ou départ collectif d'une escouade officielle ; arc n° 2, 3… à la suite |
| Objectif | Type, phrase, chiffre et unité, affiché en haut du tableau de bord |
| Principes | 84 gabarits sourcés et traduits (travail profond, grenouille, règle des 2 minutes, prospection, e-commerce, SaaS, revente, trading, prépa, fac…), choisis selon le profil, l'activité (au moins un principe par activité, pas de prospection pour le trading seul), l'école, l'objectif, les points faibles et le sport voulu ; 100 % modifiables dans une feuille avec « Enregistrer » toujours visible ; difficulté calculée par le serveur ; modification effective le lendemain |
| Preuves | Minuteur (Lancer / Stop à −5 ; quitter l'écran plus de 10 s, faire retour ou fermer l'onglet casse la session), pompes et squats comptés à la caméra (modèle préchargé, repli processeur), réveil à code, photo, capture, lien, déclaratif ; contrôles aléatoires |
| Jeu | XP, niveaux, titres, 6 stats sur 30 jours (Discipline, Focus, Corps, Business, Esprit, Énergie), note globale, séries, jokers, quête de la semaine, succès avec rareté réelle, fonds de carte à débloquer, avant / après, citation du jour |
| Portefeuille et notes | Portefeuille (arcs business, Pro) : revenus avec capture en preuve, 10 points + 1 par 10 € (la moitié sans capture, 50 par jour), succès 1 € → 10 000 € ; carnet de notes (arcs études, Pro) : notes sur 20 pondérées, moyenne par matière, forme radar « Ta progression », 5 à 20 points par note dès 10/20 (la moitié sans preuve, 30 par jour) |
| Social | Classement semaine / mois / général, monde ou pays, filtres, onglet par escouade ; escouades privées (code) ou publiques ; profil public avec photo et carte de joueur (photo et fond modifiables d'un toucher) |
| Langues | Français, anglais, allemand, espagnol : détection par le navigateur puis le pays, sélecteur dans le pied de page et le profil ; textes dans `lib/i18n/messages/<langue>/`, messages Postgres traduits dans `lib/i18n/sql-errors.ts`, pages légales dans `lib/legal-docs/` (la version française fait foi) ; emails dans la langue du joueur (aucune notification ni rappel) |
| Parcours | Questionnaire sans compte (une question par écran, activité et école selon le profil, sport facultatif, transitions animées, geste retour du téléphone respecté), écran de construction (vrai calcul des principes), résultat personnalisé avec preuve sociale réelle et plans, connexion Google, dernière étape, paiement |
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
| `AUDIT_RATE` | `0.10` | part des preuves faibles contrôlées |

## Supabase

### Migrations

Dans l'ordre, depuis [`supabase/migrations/`](supabase/migrations/) (SQL Editor ou `npx supabase db push`) :

1. `20261007100000_v2_base.sql` : réglages, limitation de débit, fonctions utilitaires
2. `20261007100100_v2_schema.sql` : tables, RLS, buckets `proofs` (privé) et `avatars` (public)
3. `20261007100200_v2_logic.sql` : règles du jeu
4. `20261007100300_v2_read_admin_cron.sql` : lectures, escouades, paiements, admin, crons
5. `20261007100400_v2_seed.sql` : plans, gabarits, quêtes, succès, escouade officielle du 1er janvier
6. `20261008100000_v3_langues_pays.sql` : langue et pays du joueur, gabarits traduits, classement du mois et par pays
7. `20261008110000_v4_parcours_metier.sql` : activité et école, 47 nouveaux gabarits, choix des principes par métier, carnet de notes, portefeuille dans l'arc business
8. `20261008120000_v5_session_quittee.sql` : `leave_session` (page du minuteur quittée = session cassée)
9. `20261009100000_v6_points_bibliotheque.sql` : points des notes et des revenus selon leur valeur (repris si on les retire), bibliothèque de principes notée par pertinence

Les migrations v3 à v5 sont regroupées dans `../deploy-v3-v5.sql` (une transaction) pour l'éditeur SQL.

**Passage de la V1 à la V2** : exécuter d'abord [`supabase/ops/reset-v1.sql`](supabase/ops/reset-v1.sql), qui supprime le schéma V1 (données comprises). Les comptes Auth restent : il suffit de refaire l'onboarding.

### Réglages Auth

- URL Configuration : Site URL = domaine ; Redirect URL `https://<domaine>/auth/callback`.
- **Connexion uniquement avec Google** (pas d'email ni de mot de passe). Fournisseur Email désactivé dans Authentication > Sign In / Providers, pour que personne ne crée de compte par email via l'API.
- Google : Authentication > Providers > Google, avec l'ID et le secret du client OAuth « Nonante Web » du projet Google Cloud « nonante » (origine `https://<domaine>`, redirection autorisée `https://<projet>.supabase.co/auth/v1/callback`). Dans Google Auth Platform > Audience, l'application doit être publiée (en mode test, seuls les utilisateurs test passent).
- **SMTP** : inutile pour la connexion (Google). Seulement pour les emails applicatifs, via `RESEND_API_KEY`.

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
| `npm run test:db` | Plus de 230 tests sur Postgres 17 (PGlite) : langues et pays, parcours métier et école, carnet de notes, session quittée, Arc 90 jours (paiement unique, crédit, fin d'arc), aperçu des principes pour un visiteur, preuve sociale, démarrage libre, principes versionnés, difficulté serveur, chaque preuve, jokers, points, stats, niveaux, quêtes, portefeuille, escouades, classement, plans et limites, abonnements, parrainage, fidélité, RLS, registre en ajout seul, admin, suppression de compte |
| `npm run lint` / `npm run typecheck` / `npm run build` | ESLint, TypeScript strict, build |

Parcours joué à 375 px contre un Supabase émulé : questionnaire visiteur → construction → plans → connexion → dernière étape → paiement simulé → tableau de bord ; arc n° 2 d'un joueur connecté ; connexion, onboarding, génération des principes, plans, tableau de bord et calendrier, validation déclarative, capture, revenu prouvé, montée de niveau, succès, photo de profil, escouade, classement, profil public, quête, avant / après.

## Choix faits en route

1. **Pas de plan gratuit** : on construit son arc gratuitement (objectif, principes), puis on choisit un plan pour le lancer. Sans abonnement actif, plus rien ne se valide.
2. **Difficulté calculée par le serveur** à partir de la preuve et de la cible : impossible de se donner 30 points pour 5 pompes.
3. **Modifications de principes le lendemain** (versions `active_from` / `active_until`) : on ne change pas les règles d'un jour déjà commencé.
4. **Stats sur 30 jours glissants** : la note baisse si on arrête, elle se mérite en continu.
5. **Portefeuille** : un revenu sans capture est noté « non prouvé » et ne compte ni pour la stat ni pour les succès. Les revenus prouvés peuvent être contrôlés (refus = retrait des points).
6. **Photos** : CC0 / domaine public via l'API Openverse (`scripts/fetch-photos.mjs`), œuvres du domaine public via Wikimedia (`npm run art:fetch`), et images fournies par l'éditeur (type « fournie » dans `public/art/credits.json`), toutes listées sur `/art`. Les images fournies avec un visage connu, une marque ou un filigrane n'ont pas été utilisées.
7. **Droit de rétractation** : case à cocher obligatoire avant paiement pour l'accès immédiat ; formulaire type dans les CGV.
8. **Aucun chiffre inventé** : les exemples de la landing sont présentés comme exemples ; le compteur Fondateur et les statistiques viennent de la base. La preuve sociale n'affiche les chiffres en direct qu'au-delà de 20 joueurs (sinon seulement les études publiées), et aucun faux avis.
9. **Questionnaire avant le compte** : on demande la connexion Google au moment où le visiteur a vu son arc et choisi son plan (effet d'investissement). Les réponses suivent dans un cookie pendant l'aller-retour chez Google, puis sont gardées côté serveur avec l'email du compte et supprimées une fois l'arc créé.
10. **Écran de construction** : il attend le vrai calcul des principes (preview_principles) et dure environ 5 secondes ; pas de faux compte à rebours ni de fausse rareté.
11. **Fluidité** : une seule vérification de session par requête (`getUser` en cache), écrans de chargement instantanés, « Fait » coché avant la réponse du serveur, transitions du questionnaire par View Transitions (transform et opacité seulement), flou limité à la barre d'onglets.
12. **Retour** : chaque question du questionnaire est une entrée de l'historique ; pendant une session, le geste retour ouvre la confirmation « −5 points » au lieu de quitter.

## Plus tard

- App iOS native avec Screen Time (blocage d'apps pendant les sessions), qui réutilisera les mêmes fonctions Postgres.
- Adhésion à un médiateur de la consommation et immatriculation (SIRET) avant les premières ventes réelles.
