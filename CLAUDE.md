@AGENTS.md

# Nonante — cahier des charges V2

> V2 décidée le 6 octobre 2026 avec Antoine Hofmann (fondateur). Elle remplace la V1 (cohortes à date fixe,
> principes imposés, pass à 19 €). Les choix techniques pris en route sont notés dans `README.md`.

## 1. Le produit en une phrase

**« 90 jours. Zéro excuse. »** Pour les étudiants et les entrepreneurs : un arc de 90 jours, des principes « si… alors… »
construits pour ton objectif, chaque jour prouvé (caméra, minuteur, réveil, photo, lien), et des stats de
joueur à maxer. Payant dès le départ : payer, c'est déjà s'engager.

## 2. La cible et ses problèmes

18-30 ans, jeunes entrepreneurs, étudiants-entrepreneurs, freelances, créateurs, salariés avec un projet à
côté. 90 % arrivent de TikTok, sur mobile. Ce qui les bloque :

| Problème | Réponse de Nonante |
|---|---|
| Téléphone, réseaux, procrastination | Sessions de concentration qui cassent si on quitte l'écran ; principes « téléphone dans une autre pièce » prouvés en photo |
| Pas de structure, pas de patron | Un objectif chiffré, des principes « si… alors… » (intentions de mise en œuvre), un calendrier de 90 points |
| Le chiffre d'affaires ne décolle pas | Principes de prospection, portefeuille de revenus prouvés, stat Business |
| Personne pour les tenir | Classement, escouades, profil public, contrôles aléatoires, argent engagé |
| Motivation en dents de scie | Discipline > motivation : séries, jokers, citations stoïciennes du jour |
| Santé sacrifiée | Pompes et squats comptés à la caméra, réveil prouvé, stats Corps et Énergie |
| Dispersion | Un seul objectif par arc, affiché en haut de chaque écran |

Différence avec les autres apps d'habitudes (WinterArc, etc.) : **rien ne se valide sans preuve**, tout est
**personnalisable selon l'objectif** (inclus dans tous les plans), c'est **pensé business** (portefeuille,
prospection) et c'est **un jeu** (stats de joueur, niveaux, classement, escouades).

## 3. Esprit de la marque

Discipline sobre et exigeante. Noir et blanc, grain photo, Instrument Serif pour les titres et grands
chiffres, Inter pour le texte, Caveat (manuscrite) pour quelques mots seulement. Animations courtes et sobres
(apparition, trait dessiné, coche), coupées si l'utilisateur réduit les animations. Pas d'emojis, pas de confettis. Couleurs : fond `#0A0A0A`, surfaces `#141414`,
traits `#2A2A2A`, texte `#F2F2F2`, secondaire `#8A8A8A`. Vert `#34C759` et rouge `#FF453A` réservés aux états
(jour, principe, gain, perte). Tutoiement, phrases courtes : « Prouve-le. », « Jour 23 sur 90. ».

Images : photos CC0 ou domaine public (script `scripts/fetch-photos.mjs`, API Openverse) et œuvres du domaine
public (`scripts/fetch-art.ts`), en noir et blanc granulé, crédit sur `/art`. **Jamais d'images Pinterest ou
Google Images, jamais le visage d'une personne connue, jamais de marque.**

## 4. Le jeu

### Arc
- 90 jours à partir du **jour 1 choisi** : aujourd'hui, demain, lundi prochain, une date (60 jours max) ou un
  **partie** à rejoindre : une partie officielle par catégorie (études, business, les deux) part chaque lundi, et chaque
  escouade peut fixer un jour 1 commun (`squads.start_date`, `squads.category`, `_party_start`). Plus de départ du 1er janvier.
- Un seul arc en cours. Après un arc (tenu, raté ou lâché), on en recommence un (arc n° 2…).
- Arc **tenu** : jours verts + jokers ≥ 75 et jamais plus de 3 jours non verts d'affilée (hors jokers).
- **Lâché** : 7 jours blancs d'affilée.

### Objectif
Type (`revenu`, `clients`, `lancement`, `audience`, `examens`, `corps`, `autre`), une phrase, un chiffre et
une unité facultatifs. Affiché en haut du tableau de bord.

### Principes (entièrement personnalisables)
- Forme « si… alors… », un **pilier** (`focus`, `corps`, `business`, `esprit`, `energie`), une **preuve**,
  une cible, des jours de la semaine.
- Proposés à partir d'une bibliothèque de gabarits fondés sur des principes qui marchent (intentions de mise en
  œuvre, travail profond, « manger la grenouille », règle des 2 minutes, règle des 100 de prospection,
  « jamais deux fois », empilement d'habitudes, réveil fixe…), choisis selon l'objectif et les réponses de
  l'onboarding. Tout est modifiable, on peut en créer de zéro.
- La **difficulté est calculée par le serveur** depuis la preuve et la cible (25/50/90 min → 1/2/3 ; pompes
  ≤ 15/≤ 40/plus ; squats ≤ 25/≤ 60/plus ; réveil ≥ 7 h 30/≥ 6 h 30/avant). Preuves faibles : 1 ou 2 au choix.
- Pendant l'arc, une modification prend effet **le lendemain** (versions `active_from` / `active_until`).
- Nombre max : 6 (Arc 90 jours), 12 (Pro et Fondateur).

### Preuves
| Type | Force | Comment |
|---|---|---|
| `session` | forte | Minuteur 25/50/90 min, deux boutons (Lancer, Stop avec confirmation −5), battement toutes les 15 s, casse après 10 s hors écran, 45 s sans battement, retour ou page quittée |
| `reps` | forte | Pompes ou squats comptés à la caméra (MediaPipe, sur l'appareil, aucune image envoyée) |
| `reveil` | forte | Ouvrir l'app dans les 2 h 30 avant l'heure et recopier un code à 6 chiffres |
| `photo` | faible | Photo prise dans l'app (pas la galerie) |
| `capture` | faible | Capture d'écran (galerie autorisée) : messages de prospection, ventes, statistiques |
| `lien` | faible | Lien d'une publication, domaine autorisé, jamais réutilisé, jamais téléchargé par le serveur |
| `declaratif` | faible | Bouton « Fait » |

Preuve forte = 100 % des points, faible = 50 %. 10 % des preuves faibles déclenchent un **contrôle** (photo à
envoyer sous 24 h, jugé dans `/admin`). Validation le jour même avant minuit (Europe/Paris), définitive.

### Points (registre en ajout seul, calculés par Postgres)
Valeur = 10 × difficulté. Raté : − valeur ; 2 jours d'affilée − 2× ; 3 et plus − 3× ; jour blanc − 2× au moins.
Session cassée − 5. Contrôle refusé − 3× valeur et +1 preuve refusée. Semaine d'arc parfaite + 50. Quête
réussie + 100/200/300, ratée − 50/100/150 ; piège ± 150. Revenu : 10 + 1 par 10 € (50 max), note : 5 à 20 selon la note
(dès 10/20) ; la moitié sans preuve, plafonds 50 et 30 par jour, repris si on retire l'entrée. Succès
+ 25 à + 300. Arc tenu + 500. Constantes dans `lib/rules.ts` et en SQL (à garder synchronisées).

### Joueur
- **XP** = somme des gains (jamais de perte). **Niveau** = ⌊√(XP / 50)⌋ + 1. Titres : Recrue (1), Initié (5),
  Constant (10), Discipliné (15), Redoutable (20), Inarrêtable (30), Légende (40).
- **6 stats sur 0-99**, calculées sur les 30 derniers jours : Discipline (jours verts ou jokers / jours clos),
  Focus, Corps, Business (dont revenus prouvés), Esprit, Énergie (XP du pilier / 600). **Note globale** =
  moyenne des 6 : pour la maxer il faut tout travailler.
- **Série** : jours verts d'affilée (un joker ne la casse pas).
- **Jokers** : 1 par arc (Arc 90 jours), 3 (Pro, Fondateur). Un joker rend la journée neutre : ni points ni pénalité.
- **Quête de la semaine** (7 jours de l'arc) tirée selon la catégorie et le palier (niveau < 8, < 16, au-delà),
  piège toutes les 4 semaines.
- **Succès** avec rareté réelle, certains débloquent un fond de carte (œuvre ou photo).
- **Photo avant / après** : prise au jour 1, verrouillée, comparée au jour 90.
- **Citation du jour** (auteurs du domaine public, traductions maison) sur le tableau de bord.

### Portefeuille (arcs business et Pro) et carnet de notes (arcs études et Pro)
Modifié le 8 octobre 2026 : le portefeuille est inclus dans l'Arc 90 jours quand le profil est business (ou les deux) ;
le carnet de notes (notes sur 20 pondérées, moyenne par matière, « Ta progression » en forme de radar, une matière par
sommet, capture en preuve) dans
les arcs études (ou les deux). On note chaque argent gagné grâce à son projet (montant, source, libellé), avec une capture en preuve.
Revenus prouvés = comptés dans la stat Business, les succès (1 €, 100 €, 1 000 €, 10 000 €) et l'objectif de
revenu. Sans capture : « non prouvé », la moitié des points, pas de succès. Visible sur le profil public seulement si l'utilisateur le
choisit. C'est un suivi personnel, jamais un gain distribué par Nonante.

### Social
- **Classement** : Semaine (depuis lundi, tout le monde repart à zéro), Mois, Général (points cumulés), Monde ou
  pays du joueur, filtre catégorie, onglet par escouade. Égalité : série, puis note globale.
- **Escouades** : groupes rejoints par code (privés) ou publics, 50 membres max, 3 escouades max par
  personne (les parties officielles n'ont pas de limite de membres). Création réservée à Pro, avec un jour 1 commun
  facultatif : la partie est alors proposée à l'inscription.
- **Profil public** : photo, carte de joueur, stats, calendrier, succès, preuves refusées, objectif et
  portefeuille si l'utilisateur le veut. Bouton « Signaler ». Pas de messages privés.
- **Mon profil** : roue dentée en haut à droite = feuille Réglages (langue, bio, public, revenus publics) et données
  (export, déconnexion, suppression du compte).
- **Fêtes** : motion design noir et blanc (`components/Celebration.tsx`) pour un succès, un niveau, une journée
  prouvée (une fois par jour) et l'objectif de revenu du mois atteint.
- **Barre d'onglets** : verre liquide (bulle qui glisse avec rebond, qu'on peut faire glisser du doigt d'un onglet à
  l'autre), `components/LiquidTabBar.tsx`.
- **Bibliothèque de principes** : triée par pertinence (même note que le choix des 6 principes), « Pour toi » = les 3
  meilleurs, chaque pilier = ses 3 meilleurs, barre de recherche sur toute la bibliothèque.

Règles absolues : l'entreprise ne gagne jamais d'argent sur l'échec d'un utilisateur ; aucune récompense en
argent ou en lot pour le classement (points, succès, œuvres seulement) ; aucun chiffre inventé : tout ce qui est
affiché vient de la base.

## 5. Modèle économique

Pas de plan gratuit. Le visiteur répond au questionnaire, voit son arc construit (investissement), puis paie pour le
lancer. Modifié le 7 octobre 2026 : l'Essentiel est remplacé par l'Arc 90 jours, payé une fois par arc.

| Plan | Prix | Contenu |
|---|---|---|
| Arc 90 jours | 19,99 € une fois, par arc | 6 principes, toutes les preuves, classement, rejoindre des escouades, 1 joker. Aucun renouvellement |
| Pro | 14,99 €/mois ou 99,99 €/an | Tous les arcs tant que l'abonnement est actif, 12 principes, portefeuille, créer des escouades, 3 jokers |
| Fondateur | 199 € une fois | Pro à vie, 100 places (compteur réel) |

- Test et live cohabitent : `settings.plans.*.price_id` (test) et `live_price_id` (live), `stripe_portal` /
  `stripe_portal_live` ; la clé `STRIPE_SECRET_KEY` (sk_live_ ou sk_test_) décide (`stripeLive()`). Voir `supabase/ops/stripe-live.sql`.
- Stripe Checkout (`payment` pour l'Arc 90 jours et Fondateur, `subscription` pour Pro), codes promo, portail client
  Stripe (factures, abonnement Pro). Prix et identifiants Stripe dans `settings.plans`.
- L'Arc 90 jours se rattache à l'arc ouvert (`enrollments.arc_paid`), ou reste en crédit (`profiles.arc_credits`)
  pour le prochain arc. L'arc terminé ou lâché, il faut un nouvel Arc 90 jours.
- Abonnement Pro inactif : l'arc continue mais plus rien ne se valide (les jours deviennent blancs).
- **Parrainage** : lien ou code perso. L'ami a −20 % sur son premier paiement (code promo appliqué tout seul s'il
  arrive par le lien) ; le parrain a −20 % lui aussi, sur sa prochaine facture Pro ou sur son prochain Arc 90 jours
  (`profiles.referral_rewards`). Une seule remise par paiement : fidélité, puis parrain, puis ami.
- **Fidélité** : arc tenu = −50 % sur la prochaine facture Pro, ou sur le prochain Arc 90 jours (`loyalty_pending`).
- Droit de rétractation : 14 jours ; case à cocher pour demander l'accès immédiat (paiement au prorata en cas
  de rétractation).

### Parcours du visiteur

Landing → `/onboarding` (sans compte) : questions une par écran (profil, activité si business, école si études,
objectif, phrase, points faibles, écran « si… alors… », réveil, concentration, sport facultatif, jour 1, engagement,
pseudo) → écran de construction (vrai calcul
`preview_principles`) → résultat personnalisé (arc, 6 principes, stats, preuve sociale, plans, objections) → « Continuer
avec Google » (les réponses suivent dans un cookie d'une heure, puis `pending_arcs`, 3 jours max) → `/onboarding/suite` (âge, accès immédiat) →
Stripe → `/app?paid=1`. Preuve sociale : seulement des chiffres réels (seuils) et des études publiées, jamais de faux
avis.

### Connexion et aide
Connexion **uniquement avec Google** (Supabase OAuth, flux PKCE, retour par `/auth/callback`) : pas d'email, pas de
code, pas de mot de passe. Onglet **Aide** dans la barre de navigation : ouvre un email vers l'adresse de contact
(`EDITOR.email`). Parrainage : bouton « Partager mon profil » (feuille de partage du téléphone, sinon copie) avec le
lien du profil public et le code de parrainage ; visible seulement si le profil est public.

### Langues
Français (source), anglais, allemand, espagnol : toute l'app, les emails et les pages légales
(la version française fait foi). Langue détectée (navigateur, puis pays), modifiable dans le pied de page et le profil.

## 6. Stack et sécurité

Next.js 16 (App Router, `proxy.ts`, Server Actions), TypeScript strict, Tailwind v4, Supabase (Auth, Postgres,
RLS partout, Storage), Stripe, Resend facultatif, MediaPipe, sharp, Zod, Vercel (+ Cron, Web Analytics sans cookie,
fonctions à Dublin `dub1`, à côté de Supabase eu-west-1). Domaine : nonante.fr (Search Console : propriété de domaine)
(Hostinger, A vers Vercel ; www redirige). Pas de notifications ni de rappels (retirés le 9 octobre 2026).

- Le client ne décide jamais : toutes les écritures de jeu passent par des fonctions `security definer` qui
  vérifient propriétaire, abonnement, jour et heure du serveur. Registre des points en ajout seul (droits
  retirés + trigger).
- CSP stricte à nonce, en-têtes de sécurité, caméra autorisée pour le site seul (`camera=(self)` partout : l'en-tête vaut
  pour tout le document, et la navigation de l'app ne recharge pas la page).
- Photos de preuve : bucket privé, ré-encodées par sharp (sans EXIF/GPS), supprimées après 30 jours. Photos de
  profil : bucket public `avatars`, ré-encodées en 512 px.
- Admin : `is_admin` + double authentification (aal2), chaque action dans `audit_log`.
- RGPD : export et suppression de compte, aucun cookie non essentiel.

## 7. Pages

`/` (landing), `/login`, `/onboarding`, `/onboarding/suite`, `/abonnement` (plans), `/faq`, `/app` (aujourd'hui), `/app/principes`,
`/app/portefeuille`, `/app/escouades`, `/app/profil`, pages de preuve plein écran (`/app/session|reps|reveil|
photo|capture|lien|controle/[id]`), `/app/niveau`, `/app/succes`, `/app/quete`, `/app/avant-apres`,
`/classement`, `/u/[pseudo]`, `/art`, `/legal/*` (mentions, CGU, CGV, confidentialité), `/admin/*`.

## 8. Définition de « terminé »

Build, lint, types et `npm run test:db` au vert ; parcours complet joué contre l'émulateur (connexion,
onboarding, abonnement, chaque preuve, joker, portefeuille, escouade, classement, profil, admin) ; chaque page
vérifiée à 375 px ; migrations appliquées en production ; chiffres affichés = chiffres de la base.
