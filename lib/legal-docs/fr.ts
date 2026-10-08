import type { LegalSet } from "@/lib/legal-docs/types";

// Version de référence : en cas de différence avec une traduction, c'est elle qui fait foi.

export const fr: LegalSet = {
  notice: null,

  mentions: {
    title: "Mentions légales",
    updated: "",
    blocks: [
      { h2: "Éditeur" },
      { p: "Le site et l'application Nonante sont édités par {name}, {address}." },
      { p: "Contact : {email}" },
      { h2: "Directeur de la publication" },
      { p: "{name}." },
      { h2: "Hébergement" },
      { p: "Site hébergé par Vercel Inc., 440 N Barranca Avenue #4133, Covina, CA 91723, États-Unis (privacy@vercel.com)." },
      {
        p: "Base de données, authentification et fichiers hébergés par Supabase Pte. Ltd., 65 Chulia Street #38-02/03, OCBC Centre, Singapour 049513 (privacy@supabase.com).",
      },
      { h2: "Propriété intellectuelle" },
      { p: "La marque Nonante, les textes, le logo et le code de l'application appartiennent à leur éditeur. Toute reproduction sans autorisation est interdite." },
      {
        p: "Les images affichées sont des photographies sous licence CC0 ou marquées « domaine public », des œuvres du domaine public et quelques images fournies par l'éditeur. Leurs auteurs et sources sont indiqués sur la page [Crédits photos](/art). Les citations du jour viennent d'auteurs du domaine public ; les traductions sont de Nonante.",
      },
      { h2: "Signaler un contenu" },
      { p: "Chaque profil public a un bouton « Signaler ». Tu peux aussi écrire à {email}." },
    ],
  },

  cgu: {
    title: "Conditions générales d'utilisation",
    updated: "En vigueur au 9 octobre 2026.",
    blocks: [
      {
        p: "Ces conditions encadrent l'utilisation du site et de l'application Nonante, édités par {name}, {address} (contact : {email}). Les conditions de paiement sont dans les [conditions générales de vente](/legal/cgv), le traitement des données dans la [politique de confidentialité](/legal/confidentialite).",
      },
      { h2: "1. Le service" },
      {
        p: "Nonante accompagne un arc de 90 jours : un objectif, des principes « si… alors… » personnalisés, des preuves quotidiennes, des statistiques de joueur, un classement, des escouades, et selon l'arc un portefeuille de revenus ou un carnet de notes. Le questionnaire et la page des plans sont accessibles sans compte ; le reste demande un compte et un plan payé.",
      },
      { h2: "2. Accès et compte" },
      {
        ul: [
          "Nonante est réservé aux personnes majeures (18 ans ou plus).",
          "Le compte se crée avec un compte Google, sans mot de passe propre à Nonante. Tu es responsable de l'accès à ton compte Google.",
          "Un compte par personne. Les adresses email jetables ne sont pas acceptées.",
          "Ton pseudo et ta photo de profil ne doivent ni usurper l'identité de quelqu'un, ni être injurieux, discriminatoires, sexuels ou contraires à la loi.",
        ],
      },
      { h2: "3. Les règles du jeu" },
      {
        p: "Les règles (points, preuves, jokers, quêtes, niveaux, classement, arc tenu ou lâché) sont décrites dans l'app et dans la [foire aux questions](/faq). Elles sont appliquées par le serveur, à l'heure de Paris, de la même façon pour tout le monde. Nonante peut les ajuster pour corriger un déséquilibre ou une faille ; un changement ne retire jamais des points déjà gagnés honnêtement.",
      },
      { h2: "4. Les preuves" },
      {
        ul: [
          "Une preuve doit correspondre à ce que tu as réellement fait, le jour même.",
          "Une partie des preuves faibles est contrôlée au hasard. Une preuve refusée entraîne les pénalités prévues par les règles du jeu et reste comptée sur ton profil.",
          "Interdit : contourner le minuteur, la caméra ou le code de réveil, réutiliser la preuve de quelqu'un d'autre, automatiser des validations, exploiter une faille au lieu de la signaler.",
          "Quitter l'écran du minuteur (plus de 10 secondes, retour, fermeture) casse la session, avec la pénalité prévue.",
          "Le comptage à la caméra se fait sur ton appareil, aucune image n'est envoyée. Les photos de preuve que tu envoies sont privées et supprimées après 30 jours.",
        ],
      },
      { h2: "5. Tes contenus" },
      {
        p: "Tu restes propriétaire de ce que tu publies (photo de profil, bio, preuves, liens, notes). Tu autorises Nonante à les stocker, les afficher selon tes réglages (public ou privé) et les contrôler, uniquement pour faire fonctionner le service et pendant la durée nécessaire. Ne publie que des contenus dont tu as les droits, et aucune photo d'une autre personne sans son accord.",
      },
      { h2: "6. Profils publics, classement et escouades" },
      {
        ul: [
          "Si ton profil est public, ton pseudo, ta photo, ta carte de joueur, ton calendrier, ton pays et tes succès sont visibles par tous ; ton objectif et ton portefeuille seulement si tu le choisis. En privé, tu apparais en « Anonyme ».",
          "Le classement, les niveaux et les succès ne donnent droit à aucun gain en argent ni en lot. Le portefeuille est un suivi personnel : Nonante ne verse, ne garde et ne transfère aucun argent.",
          "Chaque profil peut être signalé. Après examen, un profil peut être masqué et un compte suspendu ou fermé en cas de manquement à ces conditions. Tu peux contester une décision en écrivant à {email}.",
        ],
      },
      { h2: "7. Santé et conseils" },
      {
        p: "Les principes sportifs (pompes, squats, course…) et de sommeil se pratiquent sous ta responsabilité, selon ta condition physique ; demande l'avis d'un médecin en cas de doute. Les principes business, de trading et d'études sont des méthodes d'organisation, pas des conseils financiers, en investissement, juridiques ou médicaux. Nonante ne garantit pas l'atteinte de ton objectif : c'est toi qui le tiens.",
      },
      { h2: "8. Disponibilité" },
      {
        p: "Nonante fait de son mieux pour que le service soit disponible et sûr. Des interruptions peuvent survenir pour maintenance ou en cas de panne d'un prestataire ; si une panne t'empêche de valider une preuve, écris à {email} : la journée peut être corrigée après vérification.",
      },
      { h2: "9. Propriété intellectuelle" },
      {
        p: "La marque Nonante, le logo, les textes, les règles du jeu et le code de l'application sont protégés. Les images viennent de sources libres de droits, du domaine public ou de l'éditeur, créditées sur la page [Crédits photos](/art).",
      },
      { h2: "10. Fin du compte" },
      {
        p: "Tu peux exporter tes données et supprimer ton compte à tout moment depuis ton profil. La suppression efface ton profil, tes principes, tes preuves, tes notes, tes points et tes photos ; les traces de paiement sont conservées, détachées de ton compte, pour les obligations comptables.",
      },
      { h2: "11. Modifications" },
      {
        p: "Ces conditions peuvent évoluer. Les changements importants te sont annoncés dans l'app au moins 15 jours avant de s'appliquer ; si tu n'es pas d'accord, tu peux supprimer ton compte.",
      },
      { h2: "12. Droit applicable" },
      {
        p: "Ces conditions sont soumises au droit français. En cas de désaccord, écris d'abord à {email} pour trouver une solution à l'amiable ; les voies de recours prévues par les conditions générales de vente s'appliquent.",
      },
    ],
  },

  cgv: {
    title: "Conditions générales de vente",
    updated: "En vigueur au 8 octobre 2026.",
    blocks: [
      { h2: "1. Vendeur" },
      { p: "{name}, {address}. Contact : {email}." },
      { h2: "2. Le service" },
      {
        p: "Nonante est une application web qui accompagne un arc de 90 jours : un objectif, des principes « si… alors… » personnalisés, des preuves quotidiennes (minuteur, comptage de répétitions à la caméra, code de réveil, photo, capture d'écran, lien), des statistiques, un classement et des escouades. Le service est accessible depuis un navigateur, sur téléphone ou ordinateur.",
      },
      { h2: "3. Plans et prix" },
      {
        ul: [
          "Arc 90 jours : 19,99 € en un seul paiement, pour un arc de 90 jours (à partir du jour 1 choisi). Pas d'abonnement : aucun prélèvement n'a lieu ensuite. Chaque nouvel arc se paie au moment de le lancer. Le portefeuille est inclus dans les arcs business, le carnet de notes dans les arcs études.",
          "Pro : abonnement à 14,99 € par mois, ou 99,99 € par an, qui couvre tous les arcs tant qu'il est actif.",
          "Fondateur : 199 € en un seul paiement, accès au plan Pro sans limite de durée, dans la limite de 100 places.",
        ],
      },
      {
        p: "Les prix sont en euros, toutes taxes comprises. Le contenu de chaque plan est décrit sur la page Plans au moment de la commande. Un changement de prix ne s'applique jamais à un arc ou à une période déjà payés ; pour un abonnement en cours, il est annoncé au moins 30 jours à l'avance et tu peux résilier avant qu'il s'applique.",
      },
      {
        p: "L'Arc 90 jours couvre l'arc pour lequel il a été payé, jusqu'à son 90e jour ou jusqu'à ce qu'il soit lâché selon les règles du jeu (7 jours blancs d'affilée). Payé sans arc en construction, il est gardé en crédit et rattaché à ton prochain arc.",
      },
      { h2: "4. Commande et paiement" },
      {
        p: "Le paiement est traité par Stripe. Nonante n'a jamais accès à tes numéros de carte. L'abonnement Pro mensuel ou annuel se renouvelle automatiquement à la fin de chaque période, au prix en vigueur, jusqu'à résiliation. L'Arc 90 jours et le plan Fondateur ne se renouvellent jamais. Une facture est disponible pour chaque paiement dans ton espace de paiement (Profil, puis « Mes factures » ou « Gérer mon abonnement »).",
      },
      { h2: "5. Résiliation de l'abonnement Pro" },
      {
        p: "Tu peux résilier Pro à tout moment, en un clic, depuis ton profil. La résiliation prend effet à la fin de la période déjà payée : ton accès reste ouvert jusque-là, et aucun nouveau prélèvement n'a lieu. Les périodes entamées ne sont pas remboursées, sauf exercice du droit de rétractation (article 6).",
      },
      { p: "Sans abonnement actif, ton arc continue de tourner mais plus aucune preuve ne peut être validée : les jours deviennent blancs, selon les règles du jeu." },
      { h2: "6. Droit de rétractation" },
      {
        p: "Tu disposes de 14 jours à compter de ton achat (Arc 90 jours, Pro ou Fondateur) pour te rétracter, sans avoir à te justifier (articles L221-18 et suivants du Code de la consommation). Au moment du paiement, tu demandes expressément que le service commence tout de suite. Si tu te rétractes dans ces 14 jours, tu paies seulement la part du service déjà fournie jusqu'à ta rétractation, au prorata (article L221-25), et le reste t'est remboursé dans les 14 jours, par le même moyen de paiement.",
      },
      { p: "Pour te rétracter, envoie une déclaration claire à {email}, par exemple avec le modèle ci-dessous." },
      {
        quote:
          "À l'attention de {name}, {address}, {email} : je vous notifie par la présente ma rétractation du contrat portant sur le service Nonante ci-dessous. Plan : … Acheté le : … Nom et adresse email du compte : … Date : …",
      },
      { h2: "7. Remises" },
      {
        ul: [
          "Parrainage : le lien ou le code d'un joueur donne −20 % sur le premier paiement d'un nouveau joueur ; le parrain reçoit à son tour −20 % sur son prochain Arc 90 jours, ou sur sa prochaine facture Pro s'il est abonné. Une remise par filleul, une seule remise par paiement.",
          "Fidélité : un arc tenu donne −50 % sur le prochain Arc 90 jours, ou sur la prochaine facture de l'abonnement Pro, une seule fois par arc.",
        ],
      },
      { p: "Ces remises sont identiques pour tous, n'ont aucune valeur en argent et ne sont jamais liées au classement." },
      { h2: "8. Classement et jeu" },
      {
        p: "Le classement, les niveaux et les succès ne rapportent que des points, des titres et des fonds d'écran pour la carte de joueur. Aucun gain en argent ni en lot n'est attribué. Le portefeuille est un suivi personnel de ce que tu gagnes avec ton propre projet : Nonante ne verse ni ne garde d'argent.",
      },
      { h2: "9. Règles de conduite" },
      {
        p: "Les preuves doivent être réelles. Une preuve refusée lors d'un contrôle entraîne les pénalités prévues par les règles du jeu. Un comportement frauduleux, un pseudo ou une photo de profil offensants peuvent entraîner le masquage du profil ou la fermeture du compte.",
      },
      { h2: "10. Santé" },
      {
        p: "Les principes sportifs (pompes, squats, course…) se pratiquent sous ta responsabilité, selon ta condition physique. En cas de doute, demande l'avis d'un médecin. Nonante ne fournit aucun conseil médical.",
      },
      { h2: "11. Responsabilité" },
      {
        p: "Nonante s'engage à fournir le service avec soin et à le rendre disponible le mieux possible. Des interruptions ponctuelles peuvent survenir pour maintenance. La responsabilité de l'éditeur ne peut être engagée que pour un dommage direct et prouvé, dans la limite des sommes payées au cours des 12 derniers mois.",
      },
      { h2: "12. Données personnelles" },
      { p: "Le traitement de tes données est décrit dans la [politique de confidentialité](/legal/confidentialite)." },
      { h2: "13. Litiges" },
      {
        p: "Ces conditions sont soumises au droit français. En cas de difficulté, écris d'abord à {email} : on cherche une solution à l'amiable. Tu peux aussi recourir gratuitement à un médiateur de la consommation (articles L611-1 et suivants du Code de la consommation) ; ses coordonnées te sont communiquées sur simple demande. À défaut d'accord, les tribunaux français sont compétents.",
      },
    ],
  },

  privacy: {
    title: "Confidentialité",
    updated: "En vigueur au 9 octobre 2026.",
    blocks: [
      { h2: "Responsable du traitement" },
      { p: "{name}, {address}. Pour toute question sur tes données : {email}." },
      { h2: "Ce qui est collecté, et pourquoi" },
      {
        ul: [
          "Ton adresse email : pour te connecter et t'envoyer les messages liés au service. La connexion passe par Google : Nonante reçoit l'adresse email de ton compte Google, ton nom et ta photo de profil Google, rien d'autre.",
          "Ton pseudo, ton année de naissance (vérifier que tu as 18 ans), ta photo de profil et ta bio si tu les ajoutes.",
          "Ta langue et ton pays (déduit de ta connexion, au niveau du pays seulement) : pour afficher l'app dans ta langue et le classement par pays.",
          "Tes réponses au questionnaire (profil, activité, école, objectif, points faibles, rythme, sport, jour 1) : elles construisent ton arc. Si tu les donnes avant d'avoir un compte, elles sont gardées avec ton email au plus 3 jours, le temps que tu te connectes, puis supprimées.",
          "Ton objectif, tes principes, tes validations, tes sessions, tes points et tes statistiques : c'est le jeu.",
          "Tes preuves : photos prises dans l'app, captures d'écran, liens. Elles servent aux contrôles et restent privées.",
          "Ton portefeuille (montants, sources, libellés et captures des revenus que tu notes) et ton carnet de notes (matières, notes, captures), s'ils font partie de ton arc.",
          "Ta photo avant / après, si tu la prends : visible par toi seul.",
          "Le paiement : traité par Stripe. Nonante reçoit le plan, le montant et l'état de l'abonnement, jamais ta carte.",
          "La source de ta visite (paramètres utm_source et utm_campaign), pour savoir quelle publication t'a amené.",
          "Une empreinte chiffrée de ton adresse IP, pour limiter les abus (trop de tentatives). L'adresse elle-même n'est pas enregistrée.",
          "L'adresse technique de ton navigateur si tu actives les notifications.",
        ],
      },
      {
        p: "Le comptage des répétitions à la caméra se fait entièrement sur ton téléphone : aucune image de la caméra n'est envoyée, seuls le nombre et la durée des répétitions le sont.",
      },
      { h2: "Bases légales" },
      {
        ul: [
          "L'exécution du contrat : faire fonctionner ton compte, ton arc, tes preuves et ton abonnement.",
          "L'intérêt légitime : contrôles anti-triche, sécurité, statistiques internes de fréquentation et de ventes.",
          "L'obligation légale : conserver les traces de paiement (comptabilité).",
          "Ton choix : profil public, objectif ou revenus affichés, notifications. Tu peux changer d'avis à tout moment.",
        ],
      },
      { h2: "Qui y a accès" },
      {
        p: "Toi, et l'éditeur pour l'administration du service (chaque consultation d'une preuve est journalisée). Ce que tu rends public (pseudo, carte de joueur, calendrier, pays, succès, objectif ou revenus si tu le choisis) est visible par tous. Prestataires techniques, qui traitent les données pour le compte de Nonante :",
      },
      {
        ul: [
          "Supabase : base de données, authentification et fichiers.",
          "Vercel : hébergement du site (États-Unis).",
          "Stripe : paiement.",
          "Resend : envoi d'emails, s'il est activé.",
          "Google : connexion à ton compte.",
          "Les services de notification de ton navigateur (Apple, Google, Mozilla, Microsoft), si tu actives les notifications.",
        ],
      },
      {
        p: "Les transferts hors de l'Union européenne sont encadrés par les clauses contractuelles types de la Commission européenne ou par le cadre de protection des données UE–États-Unis, selon le prestataire.",
      },
      { h2: "Durées de conservation" },
      {
        ul: [
          "Photos et captures de preuve (y compris celles du portefeuille et du carnet de notes) : supprimées 30 jours après leur envoi.",
          "Photo avant / après : jusqu'à ce que tu la remplaces ou supprimes ton compte.",
          "Compte, jeu, portefeuille, carnet de notes : tant que ton compte existe. Supprime-le quand tu veux, depuis ton profil.",
          "Paiements : 10 ans (obligation comptable), détachés de ton compte s'il est supprimé.",
        ],
      },
      { h2: "Cookies" },
      {
        p: "Nonante n'utilise ni publicité ni pistage tiers. Seulement des cookies nécessaires, propres à Nonante et jamais partagés : ta session de connexion ; ta langue, si tu la choisis ; la source de ta visite, pendant 30 jours ; et, pendant une heure au plus, tes réponses au questionnaire le temps de ta connexion avec Google.",
      },
      { h2: "Tes droits" },
      {
        p: "Tu peux accéder à tes données, les rectifier, les supprimer, les exporter ou t'opposer à leur traitement. L'export et la suppression du compte se font directement depuis ton profil ; pour le reste, écris à {email}. Tu peux aussi adresser une réclamation à la CNIL (cnil.fr).",
      },
    ],
  },
};
