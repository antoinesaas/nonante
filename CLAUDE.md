@AGENTS.md

# Prompt Claude Code — V1 de Nonante

> Avance phase par phase (§16) et teste chaque phase avant de passer à la suivante.
> Nom provisoire : **Nonante**. Si tu changes de nom, remplace-le partout.
> L'état d'avancement des phases et les choix techniques pris en route sont notés dans `README.md`.

---

## 1. Contexte

Tu construis **Nonante**, une web app installable (PWA, mobile d'abord) pour les **étudiants-entrepreneurs** : des étudiants qui veulent réussir leurs études (partiels, concours, grandes écoles) et/ou leur business en parallèle.

Le principe :
- L'utilisateur s'engage sur un **arc de 90 jours** avec **un objectif et une date**.
- L'app lui **impose des principes** sous forme « si… alors… » (ex. « Si il est 7 h, alors 20 pompes »). Chaque principe a une **difficulté** et un **type de preuve**.
- **Rien ne se valide sans preuve.** Plus la preuve est forte, plus elle rapporte.
- Chaque jour apparaît comme un **point** sur un calendrier de 90 points : vert (réussi), rouge (raté), blanc (absent).
- Un **classement par points** : on gagne en validant, on perd en ratant, on perd plus en disparaissant.
- Une **épreuve par semaine** selon le niveau, des **succès** à débloquer, des **œuvres d'art** à débloquer pour son profil.

Les arcs démarrent à **dates fixes (cohortes)**. La première grosse cohorte démarre le **1er janvier**.

**Esprit de la marque** : discipline discrète et élégante, l'opposé du « grindset » bruyant. Pas d'emojis, pas de confettis, pas de jargon motivationnel. Sobre, exigeant, noir et blanc. **L'évaluation est la plus stricte possible** : c'est la promesse du produit.

## 2. Ce qui fait gagner de l'argent (à construire dès la V1)

1. **Pass d'arc (revenu principal)** : paiement unique Stripe Checkout pour rejoindre une cohorte. Prix par défaut **19 €**, prix « early bird » **15 €** tant que la cohorte n'a pas démarré. Prix stockés en base sur la cohorte (modifiables sans redéployer).
2. **Préventes** : on peut payer dès aujourd'hui pour une cohorte future (ex. celle du 1er janvier). Avant l'ouverture, une **liste d'attente** gratuite capture les emails avec la source (UTM).
3. **Parrainage** : chaque utilisateur a un code personnel (code promo Stripe) qui donne **-20 %** à un ami. On compte les ventes générées par code.
4. **Fidélité** : quiconque **tient son arc** reçoit automatiquement un code **-50 % sur l'arc suivant** (code promo Stripe à usage unique). C'est une remise commerciale identique pour tous ceux qui terminent, jamais un prix lié au classement.
5. **Mise sur soi (désactivée par défaut, `FEATURE_STAKE=false`)** : en option au paiement, l'utilisateur mise une somme (30 € par défaut) **en plus** du pass. S'il tient l'arc, la mise lui est **remboursée intégralement**. S'il lâche, elle est **reversée à une association** (versement manuel par l'admin, jamais conservée comme revenu).

Règles absolues :
- **L'entreprise ne gagne jamais d'argent sur l'échec d'un utilisateur.**
- **Les mises perdues ne sont jamais redistribuées aux autres joueurs**, ni en argent, ni en lots, ni en réductions. En France, une opération payante qui fait espérer un gain dépendant même partiellement du hasard (ici : l'échec des autres) est une loterie interdite (art. L322-2 du code de la sécurité intérieure), et l'interdiction couvre aussi les jeux d'adresse.
- **Aucune récompense en argent ou en lot pour le classement.** Le classement ne donne que des points, des succès et des œuvres.

## 3. Stack imposée

- Next.js (App Router, TypeScript strict, Server Actions), Tailwind CSS
- Supabase : Auth, Postgres, Row Level Security, Storage (bucket privé pour les preuves)
- Stripe : Checkout (paiement unique), codes promo, webhooks
- Resend pour les emails ; Web Push (VAPID, librairie `web-push`) pour les rappels sur la PWA installée
- `@mediapipe/tasks-vision` (PoseLandmarker) pour compter les répétitions à la caméra, **entièrement dans le navigateur**
- `sharp` côté serveur pour nettoyer les photos de preuve
- Vercel : hébergement + Vercel Cron
- Zod pour toute validation d'entrée
- Rien d'autre de lourd. Pas de librairie de composants : composants maison simples.

## 4. Direction visuelle

- Fond noir `#0A0A0A`, surfaces `#141414`, traits `#2A2A2A`, texte blanc cassé `#F2F2F2`, secondaire `#8A8A8A`.
- **Deux seules couleurs fonctionnelles**, réservées aux états des jours et des principes : vert `#34C759` (réussi), rouge `#FF453A` (raté). Nulle part ailleurs.
- Typo : *Instrument Serif* pour les titres et les grands chiffres, *Inter* pour le texte, via `next/font`.
- Beaucoup d'espace, grands chiffres, coins droits ou très légèrement arrondis, pas de dégradés.
- **Logo** : l'arc, un quart de cercle (90°) terminé par un point, à côté du mot « nonante » en Instrument Serif minuscule. Fournir le symbole en SVG (`public/logo.svg`), les icônes PWA (192, 512, maskable) et l'`apple-touch-icon`.
- **Mobile d'abord** : 90 % du trafic vient de TikTok. Tester chaque page à 375 px de large.
- Ton : court, direct, tutoiement sobre. Exemples : « Prouve-le. », « Jour 23 sur 90. », « 37 ont lâché. Pas toi. »

### Œuvres d'art (les images de la marque)

Les images sont des **œuvres du domaine public** : peintures minimalistes et abstraites, paysages, photographies de nature. **Jamais d'images récupérées sur Pinterest ou Google Images** : elles appartiennent à leurs auteurs.

Crée `scripts/fetch-art.ts` qui, via l'API Wikimedia Commons (`action=query`, `prop=imageinfo`, `iiprop=url|extmetadata`, `iiurlwidth=2000`) :
- cherche chaque œuvre de la liste ci-dessous ;
- **ne garde que les fichiers dont la licence (`LicenseShortName`) indique le domaine public** ;
- télécharge l'image dans `public/art/<slug>.jpg`, et sa variante en noir et blanc légèrement granulée (`sharp`) dans `public/art/<slug>-nb.jpg` ;
- écrit `public/art/credits.json` (titre, artiste, année, licence, URL source) ;
- refuse et signale toute œuvre dont la licence n'est pas claire.

Liste de départ (artistes morts depuis plus de 70 ans, ou photos d'une administration américaine) :
- Caspar David Friedrich — *Le Moine au bord de la mer* ; *Le Voyageur contemplant une mer de nuages* ; *Falaises de craie sur l'île de Rügen*
- Kasimir Malevitch — *Carré noir* (1915) ; *Carré blanc sur fond blanc* (1918)
- Piet Mondrian — *Jetée et océan* (1915)
- Vilhelm Hammershøi — un intérieur de *Strandgade 30*
- J. M. W. Turner — *Norham Castle, lever du soleil*
- Katsushika Hokusai — *La Grande Vague de Kanagawa*
- Hiroshige — un paysage de neige
- Ansel Adams — *The Tetons and the Snake River* (photo réalisée pour le National Park Service, domaine public)

Usage : écrans d'onboarding, montée de niveau, succès débloqués, fond de profil public, cartes de partage. **Jamais sur le tableau de bord**, qui reste vide de toute image. Afficher le crédit de l'œuvre en petit sous chaque image, et une page `/art` qui liste les crédits.

## 5. Les preuves (le cœur du produit)

Chaque principe a un **type de preuve**. La preuve détermine combien il rapporte : **preuve forte = 100 % des points, preuve faible = 50 %**.

| Type | Force | Pour quoi | Comment |
|---|---|---|---|
| `session` | forte | Révisions, travail profond, lecture | Minuteur de concentration intégré (voir ci-dessous) |
| `reps` | forte | Pompes, squats | Comptage à la caméra, sur l'appareil |
| `reveil` | forte | Se lever avant une heure donnée | Ouvrir l'app avant l'heure et recopier un code à 6 chiffres affiché |
| `photo` | faible | Salle de sport, lit fait, bureau rangé | Photo prise **dans l'app** (pas depuis la galerie) |
| `lien` | faible | Publier une vidéo, un post | URL d'un domaine autorisé, unique |
| `declaratif` | faible | Prospecter, règles de comportement | Bouton « Fait », soumis aux contrôles aléatoires |

### Minuteur de concentration (`session`)

C'est l'équivalent de Forest dans un navigateur.
- Durées : 25, 50 ou 90 minutes (selon le principe).
- `startSession(principleId)` (Server Action) crée une session côté serveur avec un `nonce` à usage unique. L'heure de début est **celle du serveur**.
- Le client envoie un battement toutes les 15 s (`heartbeat(sessionId, nonce)`) avec l'état de visibilité de la page.
- Si la page passe en arrière-plan plus de **10 secondes** (API Page Visibility) ou si les battements s'arrêtent plus de 45 s, la session **casse**. Visuel : l'anneau de progression se rompt.
- Demander l'API Screen Wake Lock pour garder l'écran allumé (conseil affiché : téléphone posé, écran vers le haut).
- `completeSession` n'est accepté que si le temps serveur écoulé ≥ durée prévue **et** au moins 90 % des battements attendus ont été reçus.
- Écran : très grand chiffre, anneau fin, une phrase (« Reste sur cet écran. Si tu le quittes, la session casse. »), un bouton « Abandonner » qui affiche le coût en points.

**Limite à assumer honnêtement** : une web app ne peut pas bloquer les autres applications du téléphone. Le blocage d'apps viendra avec l'app iOS native (§14).

### Comptage des répétitions (`reps`)

- Caméra frontale via `getUserMedia`, analyse avec MediaPipe PoseLandmarker **dans le navigateur**. **Aucune image ne quitte le téléphone.**
- Pompes : une répétition = angle du coude < 90° puis > 160°, épaules et hanches visibles. Squats : angle du genou < 100° puis > 160°.
- Le serveur reçoit le nombre de répétitions et l'horodatage de chacune, liés à une session `nonce`. Rejeter si une répétition dure moins de 0,8 s ou plus de 6 s, ou si l'objectif n'est pas atteint.
- Si l'utilisateur refuse la caméra, il peut valider en `declaratif` (50 % des points).

### Photos (`photo`) et captures pour les contrôles

- Capture via `getUserMedia` dans l'app (pas d'accès à la galerie pour le type `photo`).
- Envoi par URL d'upload signée vers le bucket privé `proofs/<user_id>/…`.
- Côté serveur : vérifier le vrai type de fichier, refuser au-delà de 3 Mo, ré-encoder avec `sharp` (supprime les métadonnées EXIF et la position GPS), max 1600 px.
- Les preuves ne sont **jamais publiques**. Elles sont **supprimées après 30 jours** (cron).

### Liens (`lien`)

- Domaines autorisés par principe (ex. `tiktok.com`, `instagram.com`, `youtube.com`, `linkedin.com`, `github.com`).
- Un même lien ne peut servir qu'une fois.
- **Le serveur ne télécharge jamais l'URL** (protection contre les attaques SSRF) : il vérifie seulement le format et le domaine.

### Contrôles aléatoires

- **10 %** des validations à preuve faible déclenchent un **contrôle** : l'utilisateur doit envoyer une capture ou une photo dans les **24 h**.
- L'admin accepte ou refuse dans `/admin`.
- Contrôle refusé ou non envoyé : **pénalité lourde** (§6) et compteur public « preuves refusées » sur le profil.

### Règles de validation

- Un principe se valide **le jour même, avant minuit (Europe/Paris)**. Une session commencée avant minuit compte pour le jour où elle a commencé. **Aucune validation rétroactive.**
- Une validation est définitive. Pas de modification, pas de suppression.
- Les principes sont **imposés** par l'app à partir de gabarits : la difficulté et le type de preuve sont fixés par l'app, pas par l'utilisateur. L'utilisateur peut ajouter **un seul** principe personnel, toujours en difficulté 1 et preuve `declaratif`.

## 6. Points, jours et classement

Tous les points passent par un **registre en ajout seul** (`points_ledger`). Ils sont calculés **uniquement côté serveur**, dans des fonctions Postgres, jamais par le client.

**Valeur d'un principe** : difficulté 1 = **10**, difficulté 2 = **20**, difficulté 3 = **30**.

| Événement | Points |
|---|---|
| Principe validé avec preuve forte | + valeur |
| Principe validé avec preuve faible | + valeur × 0,5 (arrondi) |
| Principe raté (jour terminé sans validation) | − valeur |
| Même principe raté **deux jours d'affilée** (règle « jamais deux fois ») | − 2 × valeur |
| Trois jours d'affilée ou plus | − 3 × valeur |
| **Jour blanc** (aucune ouverture de l'app, aucune validation) | chaque principe du jour compte − 2 × valeur (et compte comme raté pour la règle « jamais deux fois ») |
| Session de concentration cassée ou abandonnée | − 5 |
| Contrôle refusé ou non envoyé | − 3 × valeur, et +1 « preuve refusée » sur le profil |
| Épreuve de la semaine réussie | + 100 / + 200 / + 300 (niveau 1 / 2 / 3) |
| Épreuve ratée | − 50 / − 100 / − 150 |
| Piège réussi / raté | + 150 / − 150 |
| Semaine parfaite (7 jours verts) | + 50 |
| Succès débloqué | selon le succès (+ 25 à + 200) |
| Arc tenu | + 500 |

Le score peut devenir négatif. Toutes ces valeurs sont des constantes dans `lib/rules.ts`.

**État d'un jour** (calculé à la clôture, cron `day-close`) :
- **vert** : tous les principes prévus ce jour-là sont validés ;
- **rouge** : l'utilisateur a ouvert l'app ou validé quelque chose, mais au moins un principe manque ;
- **blanc** : aucune ouverture de l'app et aucune validation ce jour-là ;
- **à venir** : jours futurs (contour gris, pas plein).

**Classement** :
- Onglet **Arc** : total des points de la cohorte.
- Onglet **Semaine** : points depuis lundi. C'est un nouveau départ chaque semaine, pour que ceux qui ont chuté gardent une raison de revenir.
- Égalité départagée par le nombre de jours verts, puis par le moins de jours blancs.
- Filtre par catégorie (Études / Business / Les deux).
- En tête, les stats réelles de la cohorte : « 412 inscrits · 375 actifs · 37 ont lâché ».

**Statistiques honnêtes** : tous les chiffres affichés viennent de la base. **Jamais** de chiffre inventé, arrondi vers le haut ou gonflé. Si la cohorte a 12 inscrits, on affiche 12.

## 7. Niveaux, succès et récompenses

**Niveaux** (1 à 3) :
- +1 niveau quand l'utilisateur réussit **3 épreuves d'affilée** et n'a **aucun jour blanc** sur les 14 derniers jours.
- Ce que débloque un niveau : des principes de difficulté 3 (donc plus de points possibles), des épreuves plus dures, et une œuvre d'art pour le fond de son profil.
- Écran de montée de niveau : l'œuvre en plein écran, en noir et blanc, une phrase, rien d'autre.

**Succès** (seed, avec rareté réelle affichée : « obtenu par 4 % de la cohorte », calculée depuis la base) :
- *Premier vert* : premier jour vert (+25)
- *Première semaine parfaite* : 7 jours verts d'affilée pour la première fois (+50, en plus du bonus hebdomadaire)
- *Jamais deux fois* : 30 jours sans rater deux fois de suite le même principe (+150)
- *Aube* : 10 réveils validés avant 6 h 30 (+100)
- *Travail profond I / II / III* : 10 / 50 / 100 heures de sessions (+50 / +100 / +200)
- *Mille* : 1 000 répétitions comptées à la caméra (+100)
- *Sans filet* : 14 jours d'affilée avec uniquement des preuves fortes (+150)
- *Contrôlé* : 5 contrôles réussis (+50)
- *Mi-parcours* : jour 45 sans aucun jour blanc (+100)
- *Arc tenu* : arc terminé (œuvre spéciale ; les +500 points sont ceux du §6, jamais comptés deux fois)

Certains succès débloquent une œuvre (`art_slug`). Les succès sont visibles sur le profil public.

## 8. Modèle de données (Supabase / Postgres)

Crée les migrations SQL correspondantes, avec RLS activée sur **toutes** les tables.

```
profiles
  id uuid PK = auth.users.id
  pseudo text unique not null           -- 3 à 20 caractères, [a-z0-9_]
  birth_year int not null               -- refuser si âge < 18
  is_public boolean default false
  profile_art_slug text                 -- œuvre choisie parmi celles débloquées
  referral_code text unique
  is_admin boolean default false
  refused_proofs int default 0          -- compteur public
  created_at timestamptz default now()

cohorts
  id uuid PK, name text, start_date date, end_date date   -- end = start + 89 jours
  enroll_open boolean default true
  price_cents int default 1900, early_price_cents int default 1500
  stripe_price_id text, stripe_early_price_id text

enrollments
  id uuid PK, user_id uuid → profiles, cohort_id uuid → cohorts, unique(user_id, cohort_id)
  category text check in ('etudes','business','mixte')
  goal_title text not null, goal_public boolean default false
  weak_moments text[]
  level int default 1                   -- 1 à 3
  status text check in ('pending_payment','active','abandoned','completed','failed') default 'pending_payment'
  stripe_checkout_session_id text, paid_at timestamptz, amount_paid_cents int
  stake_cents int default 0
  stake_status text check in ('none','held','refunded','forfeited') default 'none'
  stake_payment_intent_id text
  created_at timestamptz default now()

principles
  id uuid PK, enrollment_id uuid → enrollments, position int
  if_text text, then_text text
  proof_type text check in ('session','reps','reveil','photo','lien','declaratif')
  difficulty int check between 1 and 3
  days int[] default '{1,2,3,4,5,6,7}'  -- jours de la semaine concernés (1 = lundi)
  target jsonb                          -- {"minutes":50} | {"exercise":"pushup","reps":20} | {"before":"07:00"} | {"domains":["tiktok.com"]}
  source text check in ('template','custom')

proof_sessions                          -- sessions de concentration et de répétitions
  id uuid PK, user_id uuid, principle_id uuid, kind text check in ('session','reps','reveil')
  nonce text not null, started_at timestamptz default now()   -- heure serveur
  last_heartbeat_at timestamptz, heartbeats int default 0
  ended_at timestamptz
  status text check in ('running','completed','broken','abandoned','expired') default 'running'
  data jsonb                            -- répétitions et horodatages, code de réveil haché

validations
  id uuid PK, enrollment_id uuid, principle_id uuid, day date
  proof_type text, strength text check in ('forte','faible')
  proof_session_id uuid null, photo_path text null, link_url text null
  status text check in ('valid','audit_pending','rejected') default 'valid'
  created_at timestamptz default now()
  unique(principle_id, day)

audits
  id uuid PK, validation_id uuid unique, requested_at timestamptz, due_at timestamptz
  photo_path text, status text check in ('open','submitted','passed','failed') default 'open'
  reviewed_by uuid, reviewed_at timestamptz

day_status
  enrollment_id uuid, day date, status text check in ('green','red','white')
  opened_app boolean, primary key(enrollment_id, day)

app_opens                               -- une ligne par jour et par inscription
  enrollment_id uuid, day date, primary key(enrollment_id, day)

points_ledger                           -- AJOUT SEUL
  id bigserial PK, enrollment_id uuid, user_id uuid, day date
  delta int not null, reason text not null, ref_id uuid
  created_at timestamptz default now()
  unique(reason, ref_id)                -- une même cause ne compte jamais deux fois

challenges                              -- bibliothèque d'épreuves (seed)
  id uuid PK, category text, level int, title text, description text
  kind text check in ('epreuve','piege'), proof_type text

challenge_assignments
  id uuid PK, enrollment_id uuid, challenge_id uuid, week int (1 à 13)
  status text check in ('assigned','done','failed') default 'assigned'
  validation_id uuid null
  unique(enrollment_id, week)

achievements                            -- seed
  id uuid PK, code text unique, title text, description text, points int, art_slug text null
user_achievements
  user_id uuid, achievement_id uuid, enrollment_id uuid, unlocked_at timestamptz
  primary key(user_id, achievement_id, enrollment_id)

push_subscriptions
  id uuid PK, user_id uuid, endpoint text unique, p256dh text, auth text, created_at

reports
  id uuid PK, reporter_id uuid, reported_user_id uuid, reason text, status text default 'open', created_at

waitlist
  id uuid PK, email text, cohort_id uuid, utm_source text, utm_campaign text, created_at, unique(email, cohort_id)

referrals
  id uuid PK, referrer_id uuid, enrollment_id uuid, created_at

audit_log                               -- actions admin
  id bigserial PK, admin_id uuid, action text, target text, created_at
```

**RLS et droits** :
- Chaque utilisateur **lit** ses propres lignes. Il **n'écrit directement dans aucune table de jeu** (`validations`, `proof_sessions`, `points_ledger`, `day_status`, `user_achievements`, `audits`). Toutes les écritures passent par des fonctions `security definer` appelées depuis des Server Actions, qui vérifient tout côté serveur.
- `points_ledger` : `revoke update, delete` pour tous les rôles, plus un trigger qui refuse toute modification. Le score = `sum(delta)`.
- Les données publiques passent **uniquement** par des fonctions `security definer` qui ne renvoient que des champs sûrs :
  - `leaderboard(cohort_id, category, period)` → rang, pseudo (si `is_public`, sinon « Anonyme »), catégorie, points, jours verts, niveau, `goal_title` seulement si `goal_public`.
  - `cohort_stats(cohort_id)` → inscrits payés, actifs, ont lâché, ont terminé, jours verts aujourd'hui.
  - `public_profile(pseudo)` → seulement si `is_public` : points, rang, calendrier de points (couleurs seulement), succès, niveau, œuvre de profil, preuves refusées.
  - `achievement_rarity(cohort_id)`.

## 9. Règles métier

- **Abandon** : 7 jours blancs d'affilée → `status = 'abandoned'`. L'utilisateur garde l'accès en lecture et peut rejoindre la cohorte suivante.
- **Arc tenu** (`completed`) à la fin de la cohorte si : au moins **75 jours verts sur 90** et jamais plus de 3 jours non verts d'affilée. Sinon `failed`.
- **Épreuves** : une par semaine, tirée dans la catégorie et le niveau, sans répétition. Une épreuve se prouve comme un principe (type de preuve défini dans la bibliothèque).
- **Âge** : 18 ans minimum, vérifié à l'onboarding. Refus clair sinon.
- **Pas de messages privés.** Le seul lien social : le classement, les profils publics et le bouton « Signaler ».

## 10. Pages et parcours

1. **`/` Landing** : promesse en une ligne (« Tiens 90 jours. Prouve-le. »), stats en direct de la prochaine cohorte, compte à rebours, prix (early bird si applicable), comment marchent les preuves (3 lignes), bouton « Rejoindre l'arc ». Si aucune cohorte ouverte : liste d'attente. Capturer `utm_source` et `utm_campaign` (cookie 30 jours).
2. **`/login`** : lien magique Supabase et code à 6 chiffres (pratique quand le lien s'ouvre dans le navigateur intégré de TikTok).
3. **`/onboarding`** (une question par écran, une œuvre en fond sur le premier et le dernier écran) :
   - Pseudo + année de naissance + profil public oui/non
   - Catégorie : Études / Business / Les deux
   - Objectif en une phrase + public oui/non
   - « Quand est-ce que tu décroches ? » (le soir sur le téléphone, le week-end, quand je suis fatigué, quand je ne sais pas par où commencer, quand personne ne me regarde)
   - « À quelle heure tu te lèves ? » et « Tu peux faire des pompes ? » (pour régler les principes de réveil et de sport)
   → Génère **5 principes** à partir des gabarits (§12), chacun avec sa difficulté et sa preuve, plus un principe perso facultatif. Les afficher avec leur valeur en points, puis aller au paiement.
4. **`/checkout`** : Stripe Checkout (pass, early bird si avant le départ, codes promo, option mise si `FEATURE_STAKE`). Retour sur `/app?paid=1`.
5. **`/app` Tableau de bord** (très minimaliste, aucune image) :
   - En haut : « Jour 23 / 90 », points, rang.
   - **Le calendrier** : 90 points en grille de 10 colonnes × 9 lignes. Vert = réussi, rouge = raté, blanc plein = absent, contour gris = à venir, anneau blanc = aujourd'hui. Toucher un point affiche le détail du jour. Petite légende en dessous.
   - **Aujourd'hui** : la liste des principes du jour. Pour chacun : « si… » en gris, « alors… » en blanc, la valeur en points, et un seul bouton selon la preuve (« Lancer », « Compter », « Prendre la photo », « Coller le lien », « Fait »). Une fois validé : coche verte et points gagnés.
   - L'épreuve de la semaine, en une ligne.
   - Navigation en bas : Aujourd'hui / Classement / Profil.
   - Avant le départ de l'arc : compte à rebours, principes, lien de parrainage.
6. **`/app/session/[id]`** : minuteur de concentration plein écran (§5).
7. **`/app/reps/[id]`** : caméra + compteur de répétitions.
8. **`/app/principes`** : liste des principes, non modifiables pendant l'arc.
9. **`/classement`** : onglets Arc / Semaine, filtre catégorie, stats en tête, ligne de l'utilisateur mise en avant.
10. **`/u/[pseudo]`** : profil public (œuvre en fond, points, rang, calendrier de points, succès, niveau, preuves refusées, objectif si public) + bouton « Signaler ».
11. **`/app/profil`** : ses succès, ses œuvres débloquées (choisir le fond de profil), réglages de notifications, son code de parrainage et les ventes générées, export et suppression de compte (RGPD).
12. **`/admin`** (réservé `is_admin`, double authentification obligatoire) : ventes par cohorte et par source UTM, inscrits / actifs / abandons, **file des contrôles** (voir la preuve via URL signée de 60 s, accepter / refuser), signalements, cohortes et prix, mises à rembourser et à reverser. Chaque action est écrite dans `audit_log`.
13. **`/art`** : crédits des œuvres.
14. **`/legal/cgv`, `/legal/confidentialite`, `/legal/mentions`** : gabarits **clairement marqués « À COMPLÉTER »** (éditeur, SIRET, conditions du pass, droit de rétractation, règles de la mise, traitement des photos de preuve et durée de conservation). Ne pas inventer de mentions légales.

## 11. Paiements Stripe

- Un produit « Pass d'arc » avec deux prix par cohorte (normal et early bird). Créer les objets Stripe via `scripts/stripe-setup.ts` et stocker les IDs sur la cohorte.
- Checkout en mode `payment`, `allow_promotion_codes: true`, `metadata: { enrollment_id, cohort_id, type: 'pass' }`, `client_reference_id = user_id`.
- Parrainage : à la création du profil, créer un code promo Stripe (-20 %) au nom de l'utilisateur ; au webhook, si un code de parrainage a servi, créer une ligne `referrals`.
- Fidélité : à la clôture d'un arc `completed`, créer un code promo -50 % à usage unique et l'envoyer par email.
- **Webhook `/api/stripe/webhook`** : vérifier la signature, traiter chaque événement une seule fois (table d'événements traités). Sur `checkout.session.completed` : inscription `active`, montant et date, email de bienvenue.
- Mise (si `FEATURE_STAKE`) : paiement séparé `metadata.type = 'stake'` → `stake_status = 'held'`. À la fin : arcs `completed` → remboursement Stripe → `refunded` ; `failed` / `abandoned` → `forfeited`, listés dans l'admin pour le reversement à l'association. **Avant d'activer** : vérifier le délai maximal de remboursement Stripe et faire valider les CGV par un professionnel.

## 12. Contenu de départ (seed)

**Gabarits de principes** (difficulté, preuve) — choisir selon la catégorie et les réponses de l'onboarding, 5 au total :
- Si il est [heure de lever], alors je me lève et j'ouvre Nonante. (2, `reveil`)
- Si il est 7 h, alors 20 pompes. (2, `reps`, 20 pompes) — variante débutant : 10 pompes (1)
- Si je m'assois à mon bureau, alors 50 minutes sans téléphone. (3, `session`, 50 min)
- Si je suis fatigué, alors une session de 25 minutes au lieu de rien. (1, `session`, 25 min)
- Si c'est le week-end, alors ma session la plus difficile avant midi. (3, `session`, 90 min, samedi et dimanche)
- Si je ne sais pas par où commencer, alors j'écris la plus petite prochaine action et je la fais. (1, `declaratif`)
- Si il est 22 h 30, alors mon téléphone dort dans une autre pièce. (1, `photo`)
- (Études) Si j'ai un TD à rendre, alors je le commence le jour où il est donné. (2, `declaratif`)
- (Business) Si c'est un jour de semaine, alors 3 messages à des clients potentiels. (2, `declaratif`)
- (Business) Si c'est lundi, alors je publie un contenu sur mon projet. (2, `lien`)
- Si je vais à la salle, alors une photo de la salle. (1, `photo`)

**Épreuves** (au moins 3 par catégorie et par niveau, `epreuve` ou `piege`, avec leur type de preuve) :
- Études N1 : « 3 sessions de 90 minutes cette semaine. » (`session`) N2 : « Refais un TD entier sans la correction. » (`photo` de la copie) N3 : « 10 heures de sessions cette semaine. » (`session`)
- Business N1 : « Parle à 3 clients potentiels. » (`declaratif`) N2 : « Obtiens une précommande ou un premier paiement. » (`declaratif`, contrôle obligatoire) N3 : « Publie 5 contenus en 5 jours. » (`lien`)
- Mixte N1 : « Planifie ta semaine dimanche soir. » (`photo` du planning) N2 : « Une journée entière sans réseaux sociaux. » (`declaratif`) N3 : « 100 pompes dans la semaine, comptées. » (`reps`)
- Pièges : « Le piège du vendredi : tous tes principes validés vendredi. » « Le piège du dimanche : réveil avant 8 h. » (`reveil`) « Le piège du bon élève : ta session la plus longue avant 10 h, trois jours de suite. » (`session`)

**Succès** : la liste du §7. **Cohortes** : une cohorte de test démarrant aujourd'hui, et « Arc du 1er janvier » ouverte aux préventes.

## 13. Emails, notifications et tâches planifiées

Toutes les routes cron sont protégées par `CRON_SECRET`, **idempotentes** et tolérantes à un retard d'exécution. Écrire les horaires en UTC dans `vercel.json`.

- `/api/cron/day-close` (00 h 05 Europe/Paris) : calculer `day_status` de la veille, appliquer les pénalités (ratés, « jamais deux fois », jours blancs), semaine parfaite, succès, abandons.
- `/api/cron/reminders` (18 h 30 Europe/Paris) : notification push (ou email si pas de push) à ceux qui ont encore des principes à prouver : « Il te reste 2 principes. 40 points en jeu. » Un seul rappel par jour.
- `/api/cron/weekly` (lundi 7 h) : attribuer l'épreuve, appliquer les montées de niveau, récapitulatif court.
- `/api/cron/audits` (toutes les heures si le plan Vercel le permet, sinon quotidien) : contrôles expirés → `failed` + pénalité.
- `/api/cron/cleanup` (quotidien) : supprimer les photos de preuve de plus de 30 jours, expirer les sessions `running` abandonnées.
- `/api/cron/cohort-end` (quotidien) : clôturer les cohortes, codes de fidélité, remboursements de mise si activés, email de bilan.

Si le plan Vercel limite le nombre de crons, regroupe-les dans une seule route `/api/cron/run` qui exécute les tâches dues.

Emails : texte sobre, une seule action par email, lien de désinscription des rappels.

## 14. Sécurité (niveau exigé)

Objectif : respecter le niveau 2 de l'OWASP ASVS. La règle d'or : **le client ne décide jamais de rien.** Points, validations, états des jours, niveaux et succès sont calculés côté serveur, avec l'heure du serveur.

- **Authentification** : Supabase Auth via `@supabase/ssr`, cookies `HttpOnly`, `Secure`, `SameSite=Lax`. Double authentification (TOTP) obligatoire pour les admins. Bloquer les adresses email jetables.
- **Autorisation** : RLS sur toutes les tables, aucune écriture directe du client sur les tables de jeu (§8). La clé `service_role` n'est utilisée que dans des fichiers marqués `import 'server-only'`.
- **Entrées** : chaque Server Action et chaque route valide ses entrées avec Zod et vérifie que l'utilisateur possède la ressource visée.
- **Anti-triche** : `nonce` à usage unique par session de preuve, contraintes `unique` sur les validations et le registre, temps serveur uniquement, contrôles de plausibilité (durées, répétitions), contrôles aléatoires.
- **Limitation de débit** (table Postgres ou Vercel WAF) : login, liste d'attente, validations, battements, uploads.
- **En-têtes** : Content-Security-Policy stricte avec nonce, HSTS, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (caméra uniquement sur les pages de preuve).
- **Fichiers** : bucket privé, chemins par utilisateur avec RLS sur `storage.objects`, URLs signées de courte durée, vérification du vrai type, ré-encodage `sharp`, suppression à 30 jours.
- **Stripe** : signature du webhook, idempotence, montants lus côté serveur uniquement.
- **Secrets** : uniquement en variables d'environnement, jamais dans le code ni les logs. `.env*` dans `.gitignore`.
- **Dépendances** : lockfile commité, `npm audit` sans faille haute, Dependabot activé, versions épinglées.
- **Journalisation** : `audit_log` pour toutes les actions admin. Pas de données personnelles dans les logs applicatifs.
- **RGPD** : export et suppression de compte, preuves conservées 30 jours, analyse des répétitions faite sur l'appareil, aucun cookie non essentiel (donc pas de bannière).
- **Vérifications** : les alertes de sécurité de Supabase (advisors) doivent être vides ; un script de test RLS avec deux comptes ; un test qui tente de valider sans preuve, deux fois, après minuit et pour un autre utilisateur, et vérifie que tout est refusé.

### Plus tard (hors V1) : l'app iOS et le blocage d'apps

À noter dans le README, sans le construire maintenant :
- Le blocage d'apps nécessite une app iOS native (Swift) avec les frameworks Screen Time (FamilyControls, ManagedSettings, DeviceActivity), et une **autorisation de distribution à demander à Apple** pour l'entitlement `com.apple.developer.family-controls`.
- Pendant une session, les apps choisies seront bloquées. Les principes validés feront **gagner du temps d'écran** (ex. 15 minutes de réseaux sociaux débloquées après une session de 50 minutes).
- L'app iOS réutilisera le même backend Supabase. L'API doit donc rester propre et documentée.

## 15. Variables d'environnement

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `FEATURE_STAKE=false`, `DEFAULT_STAKE_CENTS=3000`, `AUDIT_RATE=0.10`.

Fournir un `.env.example` complet.

## 16. Ordre de construction (une phase = un commit testé)

1. **Landing + liste d'attente + prévente** : déployable seule, pour vendre la cohorte du 1er janvier avant que le reste existe.
2. Auth + onboarding + génération des principes (avec difficulté et preuve) + PWA (manifest, icônes, installation).
3. Paiement Stripe + webhook + parrainage + fidélité.
4. Tableau de bord avec calendrier de points + validations `declaratif`, `reveil`, `lien` + registre de points + cron `day-close`.
5. Minuteur de concentration (`session`).
6. Caméra : comptage des répétitions (`reps`), photos (`photo`), contrôles aléatoires + file admin.
7. Classement (Arc / Semaine) + profils publics + succès + œuvres (`fetch-art`).
8. Épreuves + niveaux + rappels push et email + crons restants.
9. Admin complet + pages légales (gabarits) + passe de sécurité du §14.
10. Mise sur soi derrière `FEATURE_STAKE` (reste désactivée).

**Minimum pour le 1er janvier** : phases 1 à 5 et 7. Les phases 6 et 8 peuvent arriver pendant la première semaine de l'arc si le temps manque.

## 17. Définition de « terminé »

- Parcours complet testé en mode test Stripe : landing → login → onboarding → paiement → validations avec chaque type de preuve → calendrier → classement.
- Webhook testé avec la CLI Stripe, idempotence vérifiée.
- Tests de triche du §14 au vert ; aucun utilisateur ne peut lire les données privées d'un autre (deux comptes).
- Le registre de points est impossible à modifier, même avec la clé anon et une requête faite à la main.
- Session de concentration testée : quitter l'onglet 11 secondes la casse ; la laisser tourner jusqu'au bout la valide.
- Comptage des pompes testé sur un vrai téléphone (iPhone Safari et Android Chrome).
- Chaque page vérifiée à 375 px de large.
- Les chiffres du classement et des stats correspondent exactement à la base.
- `README.md` : installation, variables, scripts Stripe et œuvres, déploiement Vercel, création d'un admin avec double authentification, et la note sur l'app iOS.

Pose-moi une question avant de commencer seulement si un point bloque vraiment ; sinon, fais le choix le plus simple et note-le dans le README.
