-- Contenu de départ (§12) : gabarits de principes, épreuves, succès, œuvres, réglages.

insert into public.settings (key, value) values ('audit_rate', '0.10');

-- ---------------------------------------------------------------------------
-- Gabarits de principes. La difficulté et la preuve sont fixées ici, jamais par l'utilisateur.
-- ---------------------------------------------------------------------------
insert into public.principle_templates (code, categories, if_text, then_text, proof_type, difficulty, days, target) values
  ('reveil', '{etudes,business,mixte}', 'S''il est {heure}', 'alors je me lève et j''ouvre Nonante.', 'reveil', 2,
    '{1,2,3,4,5,6,7}', '{"before":"07:00"}'),
  ('pompes_20', '{etudes,business,mixte}', 'Si je sors du lit', 'alors 20 pompes.', 'reps', 2,
    '{1,2,3,4,5,6,7}', '{"exercise":"pushup","reps":20}'),
  ('pompes_10', '{etudes,business,mixte}', 'Si je sors du lit', 'alors 10 pompes.', 'reps', 1,
    '{1,2,3,4,5,6,7}', '{"exercise":"pushup","reps":10}'),
  ('squats_20', '{etudes,business,mixte}', 'Si je sors du lit', 'alors 20 squats.', 'reps', 1,
    '{1,2,3,4,5,6,7}', '{"exercise":"squat","reps":20}'),
  ('bureau_50', '{etudes,business,mixte}', 'Si je m''assois à mon bureau', 'alors 50 minutes sans téléphone.', 'session', 3,
    '{1,2,3,4,5,6,7}', '{"minutes":50}'),
  ('fatigue_25', '{etudes,business,mixte}', 'Si je suis fatigué', 'alors une session de 25 minutes au lieu de rien.', 'session', 1,
    '{1,2,3,4,5,6,7}', '{"minutes":25}'),
  ('weekend_90', '{etudes,business,mixte}', 'Si c''est le week-end', 'alors ma session la plus difficile avant midi.', 'session', 3,
    '{6,7}', '{"minutes":90,"before":"12:00"}'),
  ('petite_action', '{etudes,business,mixte}', 'Si je ne sais pas par où commencer',
    'alors j''écris la plus petite prochaine action et je la fais.', 'declaratif', 1, '{1,2,3,4,5,6,7}', '{}'),
  ('telephone_22h30', '{etudes,business,mixte}', 'S''il est 22 h 30', 'alors mon téléphone dort dans une autre pièce.', 'photo', 1,
    '{1,2,3,4,5,6,7}', '{"after":"22:30"}'),
  ('td', '{etudes,mixte}', 'Si j''ai un TD à rendre', 'alors je le commence le jour où il est donné.', 'declaratif', 2,
    '{1,2,3,4,5,6,7}', '{}'),
  ('prospection', '{business,mixte}', 'Si c''est un jour de semaine', 'alors 3 messages à des clients potentiels.', 'declaratif', 2,
    '{1,2,3,4,5}', '{}'),
  ('publication', '{business,mixte}', 'Si c''est lundi', 'alors je publie un contenu sur mon projet.', 'lien', 2,
    '{1}', '{"domains":["tiktok.com","instagram.com","youtube.com","linkedin.com","github.com","x.com"]}'),
  ('salle', '{etudes,business,mixte}', 'Si c''est lundi, mercredi ou vendredi', 'alors je vais à la salle et je la prends en photo.',
    'photo', 1, '{1,3,5}', '{}');

-- ---------------------------------------------------------------------------
-- Épreuves : 3 par catégorie et par niveau, plus les pièges.
-- ---------------------------------------------------------------------------
insert into public.challenges (code, category, level, kind, title, description, proof_type, rule, forced_audit) values
  -- Études
  ('etudes_n1_sessions', 'etudes', 1, 'epreuve', '3 sessions de 90 minutes cette semaine.',
    'Trois fois 90 minutes de travail profond, minuteur à l''appui.', 'session',
    '{"type":"sessions","count":3,"min_minutes":90}', false),
  ('etudes_n1_cinq_heures', 'etudes', 1, 'epreuve', '5 heures de sessions cette semaine.',
    'Additionne tes sessions de concentration jusqu''à 5 heures.', 'session',
    '{"type":"session_minutes","minutes":300}', false),
  ('etudes_n1_fiche', 'etudes', 1, 'epreuve', 'Une fiche de révision complète sur un chapitre.',
    'Prends ta fiche en photo, dans l''app.', 'photo', '{"type":"photo"}', false),
  ('etudes_n2_td', 'etudes', 2, 'epreuve', 'Refais un TD entier sans la correction.',
    'Prends ta copie en photo, dans l''app.', 'photo', '{"type":"photo"}', false),
  ('etudes_n2_annale', 'etudes', 2, 'epreuve', 'Une annale complète, en temps limité.',
    'Conditions d''examen, puis ta copie en photo.', 'photo', '{"type":"photo"}', false),
  ('etudes_n2_matin', 'etudes', 2, 'epreuve', '4 sessions de 50 minutes finies avant 10 h.',
    'Le matin appartient à ceux qui travaillent.', 'session',
    '{"type":"sessions_before","count":4,"min_minutes":50,"before":"10:00","consecutive":false}', false),
  ('etudes_n3_dix_heures', 'etudes', 3, 'epreuve', '10 heures de sessions cette semaine.',
    'Additionne tes sessions de concentration jusqu''à 10 heures.', 'session',
    '{"type":"session_minutes","minutes":600}', false),
  ('etudes_n3_cinq_sessions', 'etudes', 3, 'epreuve', '5 sessions de 90 minutes cette semaine.',
    'Cinq fois 90 minutes, sans téléphone.', 'session', '{"type":"sessions","count":5,"min_minutes":90}', false),
  ('etudes_n3_memoire', 'etudes', 3, 'epreuve', 'Le plan d''un chapitre entier, de mémoire.',
    'Écris-le sans notes, puis prends-le en photo.', 'photo', '{"type":"photo"}', false),
  -- Business
  ('business_n1_trois', 'business', 1, 'epreuve', 'Parle à 3 clients potentiels.',
    'De vraies conversations, pas des likes.', 'declaratif', '{"type":"declaratif"}', false),
  ('business_n1_offre', 'business', 1, 'epreuve', 'Ton offre en une phrase, publiée.',
    'Colle le lien de ta publication.', 'lien', '{"type":"links","count":1}', false),
  ('business_n1_dix_messages', 'business', 1, 'epreuve', '10 messages de prospection cette semaine.',
    'Dix personnes qui pourraient payer.', 'declaratif', '{"type":"declaratif"}', false),
  ('business_n2_precommande', 'business', 2, 'epreuve', 'Obtiens une précommande ou un premier paiement.',
    'Contrôle obligatoire : prépare ta capture.', 'declaratif', '{"type":"declaratif"}', true),
  ('business_n2_trois_contenus', 'business', 2, 'epreuve', 'Publie 3 contenus cette semaine.',
    'Trois jours différents, un lien par jour.', 'lien', '{"type":"links","count":3}', false),
  ('business_n2_appels', 'business', 2, 'epreuve', '3 appels de découverte avec des clients potentiels.',
    'Écoute plus que tu ne parles.', 'declaratif', '{"type":"declaratif"}', false),
  ('business_n3_cinq_contenus', 'business', 3, 'epreuve', 'Publie 5 contenus en 5 jours.',
    'Cinq jours différents, un lien par jour.', 'lien', '{"type":"links","count":5}', false),
  ('business_n3_dix_clients', 'business', 3, 'epreuve', 'Parle à 10 clients potentiels cette semaine.',
    'Contrôle obligatoire : garde tes échanges.', 'declaratif', '{"type":"declaratif"}', true),
  ('business_n3_page', 'business', 3, 'epreuve', 'Mets en ligne une page de vente qui accepte un paiement.',
    'Colle le lien de ta page.', 'lien', '{"type":"links","count":1}', false),
  -- Les deux
  ('mixte_n1_planning', 'mixte', 1, 'epreuve', 'Planifie ta semaine dimanche soir.',
    'Ton planning en photo, dans l''app.', 'photo', '{"type":"photo"}', false),
  ('mixte_n1_sessions', 'mixte', 1, 'epreuve', '3 sessions de 50 minutes cette semaine.',
    'Trois fois 50 minutes sans téléphone.', 'session', '{"type":"sessions","count":3,"min_minutes":50}', false),
  ('mixte_n1_pompes', 'mixte', 1, 'epreuve', '50 pompes dans la semaine, comptées.',
    'Comptées à la caméra, sur ton téléphone.', 'reps', '{"type":"reps","exercise":"pushup","count":50}', false),
  ('mixte_n2_sans_reseaux', 'mixte', 2, 'epreuve', 'Une journée entière sans réseaux sociaux.',
    'De ton réveil à ton coucher.', 'declaratif', '{"type":"declaratif"}', false),
  ('mixte_n2_six_heures', 'mixte', 2, 'epreuve', '6 heures de sessions cette semaine.',
    'Additionne tes sessions de concentration jusqu''à 6 heures.', 'session',
    '{"type":"session_minutes","minutes":360}', false),
  ('mixte_n2_aube', 'mixte', 2, 'epreuve', 'Debout avant 6 h 30, trois fois cette semaine.',
    'Tes réveils prouvés comptent.', 'reveil', '{"type":"wakes","count":3,"before":"06:30"}', false),
  ('mixte_n3_cent_pompes', 'mixte', 3, 'epreuve', '100 pompes dans la semaine, comptées.',
    'Comptées à la caméra, sur ton téléphone.', 'reps', '{"type":"reps","exercise":"pushup","count":100}', false),
  ('mixte_n3_dix_heures', 'mixte', 3, 'epreuve', '10 heures de sessions cette semaine.',
    'Additionne tes sessions de concentration jusqu''à 10 heures.', 'session',
    '{"type":"session_minutes","minutes":600}', false),
  ('mixte_n3_trois_jours', 'mixte', 3, 'epreuve', 'Trois jours sans réseaux sociaux.',
    'Trois jours entiers. Un contrôle peut tomber.', 'declaratif', '{"type":"declaratif"}', false),
  -- Pièges
  ('piege_vendredi', 'tous', 1, 'piege', 'Le piège du vendredi.',
    'Tous tes principes validés vendredi.', null, '{"type":"green_day","isodow":5}', false),
  ('piege_dimanche', 'tous', 1, 'piege', 'Le piège du dimanche.',
    'Réveil prouvé avant 8 h, dimanche.', 'reveil', '{"type":"wake","isodow":7,"before":"08:00"}', false),
  ('piege_bon_eleve', 'tous', 1, 'piege', 'Le piège du bon élève.',
    'Ta session la plus longue, finie avant 10 h, trois jours de suite.', 'session',
    '{"type":"sessions_before","count":3,"before":"10:00","consecutive":true}', false);

-- ---------------------------------------------------------------------------
-- Succès (§7)
-- ---------------------------------------------------------------------------
insert into public.achievements (code, title, description, points, art_slug, sort) values
  ('premier_vert', 'Premier vert', 'Ton premier jour vert.', 25, 'hokusai-vague', 1),
  ('premiere_semaine_parfaite', 'Première semaine parfaite', '7 jours verts d''affilée, pour la première fois.', 50,
    'mondrian-jetee', 2),
  ('jamais_deux_fois', 'Jamais deux fois', '30 jours sans rater deux fois de suite le même principe.', 150,
    'hammershoi-strandgade', 3),
  ('aube', 'Aube', '10 réveils prouvés avant 6 h 30.', 100, 'hiroshige-neige', 4),
  ('travail_profond_1', 'Travail profond I', '10 heures de sessions.', 50, null, 5),
  ('travail_profond_2', 'Travail profond II', '50 heures de sessions.', 100, null, 6),
  ('travail_profond_3', 'Travail profond III', '100 heures de sessions.', 200, 'malevitch-carre-noir', 7),
  ('mille', 'Mille', '1 000 répétitions comptées à la caméra.', 100, null, 8),
  ('sans_filet', 'Sans filet', '14 jours d''affilée, uniquement des preuves fortes.', 150, 'friedrich-rugen', 9),
  ('controle', 'Contrôlé', '5 contrôles réussis.', 50, null, 10),
  ('mi_parcours', 'Mi-parcours', 'Jour 45, sans aucun jour blanc.', 100, null, 11),
  ('arc_tenu', 'Arc tenu', '90 jours tenus.', 0, 'adams-tetons', 12);

insert into public.art_unlocks (slug, unlock) values
  ('friedrich-moine', 'base'),
  ('malevitch-carre-blanc', 'base'),
  ('friedrich-voyageur', 'level:2'),
  ('turner-norham', 'level:3'),
  ('hokusai-vague', 'achievement:premier_vert'),
  ('mondrian-jetee', 'achievement:premiere_semaine_parfaite'),
  ('hammershoi-strandgade', 'achievement:jamais_deux_fois'),
  ('hiroshige-neige', 'achievement:aube'),
  ('malevitch-carre-noir', 'achievement:travail_profond_3'),
  ('friedrich-rugen', 'achievement:sans_filet'),
  ('adams-tetons', 'achievement:arc_tenu');
