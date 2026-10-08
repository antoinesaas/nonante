-- V4 · Parcours orienté métier : type de business, école, sport facultatif ; bibliothèque de principes élargie ;
-- carnet de notes (études) ; portefeuille inclus dans l'Arc 90 jours pour les arcs business.

alter table public.enrollments add column if not exists business_types text[] not null default '{}';
alter table public.enrollments add column if not exists business_other text check (length(business_other) <= 60);
alter table public.enrollments add column if not exists school text
  check (school in ('lycee', 'prepa', 'universite', 'commerce', 'ingenieur', 'bts_but', 'autre'));
alter table public.enrollments add column if not exists school_other text check (length(school_other) <= 60);

alter table public.principle_templates add column if not exists business_types text[] not null default '{}';
alter table public.principle_templates add column if not exists schools text[] not null default '{}';
alter table public.principle_templates add column if not exists not_for text[] not null default '{}';

alter table public.points_ledger drop constraint if exists points_ledger_reason_check;
alter table public.points_ledger add constraint points_ledger_reason_check check (reason in (
  'validation', 'missed', 'session_broken', 'audit_failed', 'challenge', 'challenge_audit_failed',
  'perfect_week', 'achievement', 'arc_completed', 'wallet', 'wallet_audit_failed', 'grade'
));

-- Carnet de notes (études) : une note, une matière, une capture en preuve si possible.
create table if not exists public.grades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  enrollment_id uuid references public.enrollments (id) on delete set null,
  day date not null,
  subject text not null check (length(subject) between 2 and 60),
  score numeric(7, 2) not null check (score >= 0),
  out_of numeric(7, 2) not null check (out_of > 0 and out_of <= 1000),
  coefficient numeric(5, 2) not null default 1 check (coefficient > 0 and coefficient <= 100),
  proof_path text,
  proof_deleted_at timestamptz,
  status text not null default 'declared' check (status in ('declared', 'proven')),
  created_at timestamptz not null default now(),
  check (score <= out_of)
);
create unique index if not exists grades_proof_path_key on public.grades (proof_path) where proof_path is not null;
create index if not exists grades_user_day_idx on public.grades (user_id, day);
alter table public.grades enable row level security;
drop policy if exists "grades : lecture des siennes" on public.grades;
create policy "grades : lecture des siennes" on public.grades for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.grades from anon, authenticated;
grant select on public.grades to authenticated;

-- Portefeuille : Pro et Fondateur, ou un arc business (Arc 90 jours compris). Carnet de notes : arcs études.
create or replace function public._can_wallet(p_user uuid) returns boolean
language sql stable set search_path = '' as $$
  select case
    when public._plan(p_user) in ('pro', 'fondateur') then true
    when public._plan(p_user) is null then false
    else exists (select 1 from public.enrollments e where e.user_id = p_user and e.status in ('draft', 'active')
      and e.category in ('business', 'mixte'))
  end;
$$;

create or replace function public._can_grades(p_user uuid) returns boolean
language sql stable set search_path = '' as $$
  select case
    when public._plan(p_user) is null then false
    else exists (select 1 from public.enrollments e where e.user_id = p_user and e.status in ('draft', 'active')
      and e.category in ('etudes', 'mixte'))
      or public._plan(p_user) in ('pro', 'fondateur')
  end;
$$;

-- Bibliothèque élargie : principes par métier et par école.
insert into public.principle_templates
  (code, pillar, goal_types, weak_points, categories, business_types, schools, not_for, if_text, then_text, proof_type,
   difficulty, days, target, why, source, sort, i18n)
values
  ('ecom_pub', 'business', '{revenu,clients}', '{vente}', '{business,mixte}', '{ecommerce}', '{}', '{}', 'Si c''est un jour de semaine', 'alors je teste ou j''améliore une publicité ou une fiche produit', 'capture', 2, '{1,2,3,4,5}', '{}', 'Chaque test t''apprend ce qui fait acheter. Sans test, tu devines.', 'Tests A/B, marketing direct', 60, '{"en": {"if_text": "If it''s a weekday", "then_text": "I test or improve one ad or product page", "why": "Every test teaches you what makes people buy. Without testing, you''re guessing.", "source": "A/B testing, direct marketing"}, "de": {"if_text": "Wenn Werktag ist", "then_text": "teste oder verbessere ich eine Anzeige oder eine Produktseite", "why": "Jeder Test zeigt dir, was Menschen kaufen lässt. Ohne Test rätst du nur.", "source": "A/B-Tests, Direktmarketing"}, "es": {"if_text": "Si es día laborable", "then_text": "pruebo o mejoro un anuncio o una ficha de producto", "why": "Cada prueba te enseña qué hace comprar. Sin probar, adivinas.", "source": "Tests A/B, marketing directo"}}'::jsonb),
  ('ecom_expedition', 'business', '{revenu,clients}', '{}', '{business,mixte}', '{ecommerce}', '{}', '{}', 'Si une commande arrive', 'alors elle part dans les 24 heures', 'declaratif', 1, '{1,2,3,4,5,6,7}', '{}', 'La vitesse d''expédition fait les bons avis, et les bons avis font les ventes.', 'Expérience client', 61, '{"en": {"if_text": "If an order comes in", "then_text": "it ships within 24 hours", "why": "Fast shipping makes good reviews, and good reviews make sales.", "source": "Customer experience"}, "de": {"if_text": "Wenn eine Bestellung eingeht", "then_text": "geht sie innerhalb von 24 Stunden raus", "why": "Schneller Versand bringt gute Bewertungen, und gute Bewertungen bringen Verkäufe.", "source": "Kundenerlebnis"}, "es": {"if_text": "Si llega un pedido", "then_text": "sale en menos de 24 horas", "why": "Un envío rápido trae buenas reseñas, y las buenas reseñas traen ventas.", "source": "Experiencia de cliente"}}'::jsonb),
  ('ecom_chiffres', 'business', '{revenu}', '{dispersion}', '{business,mixte}', '{ecommerce}', '{}', '{}', 'Si c''est lundi', 'alors j''analyse la semaine passée : ventes, taux de conversion, panier moyen', 'capture', 1, '{1}', '{}', 'Ce qui se mesure s''améliore. Trois chiffres suffisent pour savoir où agir.', 'Pilotage e-commerce', 62, '{"en": {"if_text": "If it''s Monday", "then_text": "I review last week: sales, conversion rate, average order value", "why": "What gets measured gets improved. Three numbers are enough to know where to act.", "source": "E-commerce metrics"}, "de": {"if_text": "Wenn Montag ist", "then_text": "analysiere ich die letzte Woche: Umsatz, Conversion-Rate, Warenkorbwert", "why": "Was gemessen wird, wird besser. Drei Zahlen reichen, um zu wissen, wo du ansetzt.", "source": "E-Commerce-Kennzahlen"}, "es": {"if_text": "Si es lunes", "then_text": "analizo la semana pasada: ventas, tasa de conversión, ticket medio", "why": "Lo que se mide mejora. Tres cifras bastan para saber dónde actuar.", "source": "Métricas de e-commerce"}}'::jsonb),
  ('ecom_avis', 'business', '{clients}', '{}', '{business,mixte}', '{ecommerce,service_local}', '{}', '{}', 'Si un client laisse un avis', 'alors je lui réponds le jour même', 'declaratif', 1, '{1,2,3,4,5,6,7}', '{}', 'Répondre aux avis rassure les prochains acheteurs et fait d''un client un ambassadeur.', 'Service client', 63, '{"en": {"if_text": "If a customer leaves a review", "then_text": "I reply the same day", "why": "Replying to reviews reassures future buyers and turns customers into ambassadors.", "source": "Customer service"}, "de": {"if_text": "Wenn ein Kunde eine Bewertung hinterlässt", "then_text": "antworte ich noch am selben Tag", "why": "Auf Bewertungen zu antworten beruhigt künftige Käufer und macht Kunden zu Botschaftern.", "source": "Kundenservice"}, "es": {"if_text": "Si un cliente deja una reseña", "then_text": "le respondo el mismo día", "why": "Responder a las reseñas da confianza a los próximos compradores y convierte clientes en embajadores.", "source": "Atención al cliente"}}'::jsonb),
  ('agence_prospection', 'business', '{clients,revenu}', '{vente}', '{business,mixte}', '{agence,service_local}', '{}', '{trading}', 'Si c''est un jour de semaine', 'alors 10 messages personnalisés à des entreprises qui pourraient avoir besoin de moi', 'capture', 2, '{1,2,3,4,5}', '{"count":10,"unit":"messages"}', 'Dix messages bien ciblés valent mieux que cent envois en masse.', 'Prospection B2B', 64, '{"en": {"if_text": "If it''s a weekday", "then_text": "10 personalised messages to companies that could need me", "why": "Ten well-targeted messages beat a hundred mass emails.", "source": "B2B prospecting", "unit": "messages"}, "de": {"if_text": "Wenn Werktag ist", "then_text": "10 persönliche Nachrichten an Firmen, die mich brauchen könnten", "why": "Zehn gut gezielte Nachrichten schlagen hundert Massenmails.", "source": "B2B-Akquise", "unit": "Nachrichten"}, "es": {"if_text": "Si es día laborable", "then_text": "10 mensajes personalizados a empresas que podrían necesitarme", "why": "Diez mensajes bien dirigidos valen más que cien envíos masivos.", "source": "Prospección B2B", "unit": "mensajes"}}'::jsonb),
  ('temoignage', 'business', '{clients,revenu}', '{vente}', '{business,mixte}', '{agence,coaching,service_local,saas}', '{}', '{trading}', 'Si je termine une mission', 'alors je demande un témoignage et une recommandation', 'declaratif', 1, '{1,2,3,4,5,6,7}', '{}', 'Un client satisfait est ta meilleure source de nouveaux clients : il suffit de demander.', 'Bouche-à-oreille, preuve sociale', 65, '{"en": {"if_text": "If I finish a project", "then_text": "I ask for a testimonial and a referral", "why": "A happy client is your best source of new clients: you just have to ask.", "source": "Word of mouth, social proof"}, "de": {"if_text": "Wenn ich einen Auftrag abschließe", "then_text": "bitte ich um ein Testimonial und eine Empfehlung", "why": "Ein zufriedener Kunde ist deine beste Quelle für neue Kunden: Du musst nur fragen.", "source": "Mundpropaganda, Social Proof"}, "es": {"if_text": "Si termino un encargo", "then_text": "pido un testimonio y una recomendación", "why": "Un cliente satisfecho es tu mejor fuente de nuevos clientes: solo hay que pedirlo.", "source": "Boca a boca, prueba social"}}'::jsonb),
  ('agence_devis', 'business', '{clients,revenu}', '{vente}', '{business,mixte}', '{agence,service_local,immobilier}', '{}', '{trading}', 'Si c''est vendredi', 'alors je relance chaque devis en attente', 'declaratif', 1, '{5}', '{}', 'Un devis sans relance est souvent un devis perdu. Une relance polie suffit souvent.', 'Relance commerciale', 66, '{"en": {"if_text": "If it''s Friday", "then_text": "I follow up on every pending quote", "why": "A quote without a follow-up is often a lost quote. A polite nudge is often enough.", "source": "Sales follow-up"}, "de": {"if_text": "Wenn Freitag ist", "then_text": "hake ich bei jedem offenen Angebot nach", "why": "Ein Angebot ohne Nachfassen ist oft verloren. Eine höfliche Erinnerung reicht oft.", "source": "Vertriebs-Nachfassen"}, "es": {"if_text": "Si es viernes", "then_text": "hago seguimiento de cada presupuesto pendiente", "why": "Un presupuesto sin seguimiento suele ser un presupuesto perdido. Un recordatorio amable suele bastar.", "source": "Seguimiento comercial"}}'::jsonb),
  ('agence_livrable', 'focus', '{clients,revenu,lancement}', '{procrastination,dispersion}', '{business,mixte}', '{agence,coaching}', '{}', '{}', 'Si je commence ma journée', 'alors 90 minutes sur le livrable client le plus important, avant les emails', 'session', 3, '{1,2,3,4,5}', '{"minutes":90}', 'Les emails peuvent attendre. Le travail qui paie, non.', 'Cal Newport, Deep Work', 67, '{"en": {"if_text": "If I''m starting my day", "then_text": "90 minutes on the most important client deliverable, before email", "why": "Email can wait. The work that pays can''t.", "source": "Cal Newport, Deep Work"}, "de": {"if_text": "Wenn ich meinen Tag beginne", "then_text": "90 Minuten am wichtigsten Kundenprojekt, vor den E-Mails", "why": "E-Mails können warten. Die Arbeit, die bezahlt wird, nicht.", "source": "Cal Newport, Deep Work"}, "es": {"if_text": "Si empiezo mi día", "then_text": "90 minutos en el entregable más importante para un cliente, antes de los correos", "why": "Los correos pueden esperar. El trabajo que paga, no.", "source": "Cal Newport, Deep Work"}}'::jsonb),
  ('saas_utilisateur', 'business', '{lancement,clients,revenu}', '{vente}', '{business,mixte}', '{saas}', '{}', '{trading}', 'Si c''est un jour de semaine', 'alors je parle à un utilisateur ou à un client potentiel', 'declaratif', 2, '{1,2,3,4,5}', '{}', 'Les meilleures idées de produit viennent des gens qui l''utilisent, pas de ton bureau.', 'Y Combinator : parler aux utilisateurs', 68, '{"en": {"if_text": "If it''s a weekday", "then_text": "I talk to a user or a potential customer", "why": "The best product ideas come from the people using it, not from your desk.", "source": "Y Combinator: talk to users"}, "de": {"if_text": "Wenn Werktag ist", "then_text": "spreche ich mit einem Nutzer oder potenziellen Kunden", "why": "Die besten Produktideen kommen von den Nutzern, nicht von deinem Schreibtisch.", "source": "Y Combinator: Sprich mit Nutzern"}, "es": {"if_text": "Si es día laborable", "then_text": "hablo con un usuario o un cliente potencial", "why": "Las mejores ideas de producto vienen de quienes lo usan, no de tu escritorio.", "source": "Y Combinator: hablar con los usuarios"}}'::jsonb),
  ('saas_changelog', 'business', '{lancement,audience}', '{regularite}', '{business,mixte}', '{saas}', '{}', '{}', 'Si c''est vendredi', 'alors je publie ce qui a changé dans mon produit cette semaine', 'lien', 1, '{5}', '{}', 'Montrer que le produit avance rassure tes utilisateurs et te force à avancer.', 'Construire en public', 69, '{"en": {"if_text": "If it''s Friday", "then_text": "I publish what changed in my product this week", "why": "Showing that the product moves forward reassures users and forces you to keep shipping.", "source": "Building in public"}, "de": {"if_text": "Wenn Freitag ist", "then_text": "veröffentliche ich, was sich diese Woche an meinem Produkt geändert hat", "why": "Zu zeigen, dass das Produkt vorankommt, beruhigt Nutzer und zwingt dich weiterzumachen.", "source": "Building in Public"}, "es": {"if_text": "Si es viernes", "then_text": "publico lo que ha cambiado en mi producto esta semana", "why": "Mostrar que el producto avanza da confianza a tus usuarios y te obliga a seguir avanzando.", "source": "Construir en público"}}'::jsonb),
  ('saas_support', 'business', '{clients}', '{}', '{business,mixte}', '{saas,ecommerce}', '{}', '{}', 'Si un utilisateur signale un problème', 'alors je lui réponds dans les 24 heures', 'declaratif', 1, '{1,2,3,4,5,6,7}', '{}', 'Répondre vite transforme un utilisateur agacé en fan.', 'Support client', 70, '{"en": {"if_text": "If a user reports a problem", "then_text": "I reply within 24 hours", "why": "Replying fast turns an annoyed user into a fan.", "source": "Customer support"}, "de": {"if_text": "Wenn ein Nutzer ein Problem meldet", "then_text": "antworte ich innerhalb von 24 Stunden", "why": "Schnell zu antworten macht aus einem genervten Nutzer einen Fan.", "source": "Kundensupport"}, "es": {"if_text": "Si un usuario informa de un problema", "then_text": "le respondo en menos de 24 horas", "why": "Responder rápido convierte a un usuario molesto en un fan.", "source": "Soporte al cliente"}}'::jsonb),
  ('contenu_commentaires', 'business', '{audience}', '{}', '{business,mixte}', '{contenu,coaching}', '{}', '{}', 'Si je publie un contenu', 'alors 15 minutes à répondre aux commentaires', 'declaratif', 1, '{1,2,3,4,5,6,7}', '{}', 'Les premières minutes après une publication comptent : répondre crée une communauté.', 'Création de contenu', 71, '{"en": {"if_text": "If I publish a post", "then_text": "15 minutes replying to comments", "why": "The first minutes after posting matter: replying builds a community.", "source": "Content creation"}, "de": {"if_text": "Wenn ich einen Beitrag veröffentliche", "then_text": "15 Minuten Kommentare beantworten", "why": "Die ersten Minuten nach dem Posten zählen: Antworten baut eine Community auf.", "source": "Content-Erstellung"}, "es": {"if_text": "Si publico un contenido", "then_text": "15 minutos respondiendo comentarios", "why": "Los primeros minutos tras publicar cuentan: responder crea comunidad.", "source": "Creación de contenido"}}'::jsonb),
  ('contenu_idees', 'business', '{audience}', '{regularite,procrastination}', '{business,mixte}', '{contenu,coaching}', '{}', '{}', 'Si c''est dimanche', 'alors j''écris les idées de mes 5 prochains contenus', 'photo', 1, '{7}', '{}', 'Avec une liste d''idées, tu ne perds plus de temps à te demander quoi publier.', 'Planification éditoriale', 72, '{"en": {"if_text": "If it''s Sunday", "then_text": "I write down ideas for my next 5 posts", "why": "With a list of ideas, you stop wasting time wondering what to post.", "source": "Content planning"}, "de": {"if_text": "Wenn Sonntag ist", "then_text": "schreibe ich Ideen für meine nächsten 5 Beiträge auf", "why": "Mit einer Ideenliste verlierst du keine Zeit mehr mit der Frage, was du posten sollst.", "source": "Redaktionsplanung"}, "es": {"if_text": "Si es domingo", "then_text": "escribo ideas para mis 5 próximos contenidos", "why": "Con una lista de ideas dejas de perder tiempo pensando qué publicar.", "source": "Planificación editorial"}}'::jsonb),
  ('contenu_analyse', 'business', '{audience}', '{dispersion}', '{business,mixte}', '{contenu}', '{}', '{}', 'Si c''est lundi', 'alors j''analyse mes 3 meilleurs contenus de la semaine et pourquoi ils ont marché', 'capture', 1, '{1}', '{}', 'Refaire ce qui marche est plus rapide que deviner.', 'Analyse de performance', 73, '{"en": {"if_text": "If it''s Monday", "then_text": "I analyse my 3 best posts of the week and why they worked", "why": "Repeating what works is faster than guessing.", "source": "Performance analysis"}, "de": {"if_text": "Wenn Montag ist", "then_text": "analysiere ich meine 3 besten Beiträge der Woche und warum sie funktioniert haben", "why": "Wiederholen, was funktioniert, ist schneller als raten.", "source": "Performance-Analyse"}, "es": {"if_text": "Si es lunes", "then_text": "analizo mis 3 mejores contenidos de la semana y por qué funcionaron", "why": "Repetir lo que funciona es más rápido que adivinar.", "source": "Análisis de rendimiento"}}'::jsonb),
  ('revente_annonces', 'business', '{revenu}', '{regularite}', '{business,mixte}', '{revente}', '{}', '{}', 'Si c''est un jour de semaine', 'alors je mets en ligne 5 nouvelles annonces', 'capture', 2, '{1,2,3,4,5}', '{"count":5,"unit":"annonces"}', 'En revente, le volume d''annonces en ligne fait le chiffre d''affaires.', 'Achat-revente', 74, '{"en": {"if_text": "If it''s a weekday", "then_text": "I post 5 new listings", "why": "In reselling, the number of live listings drives revenue.", "source": "Reselling", "unit": "listings"}, "de": {"if_text": "Wenn Werktag ist", "then_text": "stelle ich 5 neue Anzeigen online", "why": "Beim Wiederverkauf macht die Zahl der Anzeigen den Umsatz.", "source": "Wiederverkauf", "unit": "Anzeigen"}, "es": {"if_text": "Si es día laborable", "then_text": "publico 5 anuncios nuevos", "why": "En la reventa, el volumen de anuncios publicados hace la facturación.", "source": "Compraventa", "unit": "anuncios"}}'::jsonb),
  ('revente_expedition', 'business', '{revenu}', '{}', '{business,mixte}', '{revente}', '{}', '{}', 'Si un article est vendu', 'alors je l''expédie le jour même', 'declaratif', 1, '{1,2,3,4,5,6,7}', '{}', 'Une expédition rapide, ce sont de bonnes notes, donc plus de ventes.', 'Achat-revente', 75, '{"en": {"if_text": "If an item sells", "then_text": "I ship it the same day", "why": "Fast shipping means good ratings, which means more sales.", "source": "Reselling"}, "de": {"if_text": "Wenn ein Artikel verkauft ist", "then_text": "verschicke ich ihn noch am selben Tag", "why": "Schneller Versand bringt gute Bewertungen und damit mehr Verkäufe.", "source": "Wiederverkauf"}, "es": {"if_text": "Si vendo un artículo", "then_text": "lo envío el mismo día", "why": "Un envío rápido son buenas valoraciones, y por tanto más ventas.", "source": "Compraventa"}}'::jsonb),
  ('revente_sourcing', 'business', '{revenu}', '{}', '{business,mixte}', '{revente}', '{}', '{}', 'Si c''est le week-end', 'alors je cherche de la marchandise : friperies, brocantes, lots', 'photo', 2, '{6,7}', '{}', 'On gagne de l''argent à l''achat : un bon sourcing fait la marge.', 'Achat-revente', 76, '{"en": {"if_text": "If it''s the weekend", "then_text": "I look for stock: thrift stores, flea markets, bundles", "why": "You make money when you buy: good sourcing makes the margin.", "source": "Reselling"}, "de": {"if_text": "Wenn Wochenende ist", "then_text": "suche ich Ware: Secondhandläden, Flohmärkte, Restposten", "why": "Das Geld verdienst du beim Einkauf: Gute Beschaffung macht die Marge.", "source": "Wiederverkauf"}, "es": {"if_text": "Si es fin de semana", "then_text": "busco mercancía: tiendas de segunda mano, rastros, lotes", "why": "El dinero se gana al comprar: un buen abastecimiento hace el margen.", "source": "Compraventa"}}'::jsonb),
  ('revente_prix', 'business', '{revenu}', '{}', '{business,mixte}', '{revente,ecommerce}', '{}', '{}', 'Si une annonce n''a pas bougé depuis 7 jours', 'alors je refais les photos ou je baisse le prix', 'declaratif', 1, '{1,2,3,4,5,6,7}', '{}', 'Un article qui dort, c''est de l''argent bloqué. Mieux vaut le faire tourner.', 'Rotation du stock', 77, '{"en": {"if_text": "If a listing hasn''t moved in 7 days", "then_text": "I retake the photos or lower the price", "why": "A sleeping item is money stuck. Better to keep stock moving.", "source": "Stock turnover"}, "de": {"if_text": "Wenn sich eine Anzeige seit 7 Tagen nicht bewegt hat", "then_text": "mache ich neue Fotos oder senke den Preis", "why": "Ein Artikel, der liegt, ist gebundenes Geld. Besser, der Bestand dreht sich.", "source": "Lagerumschlag"}, "es": {"if_text": "Si un anuncio lleva 7 días sin moverse", "then_text": "rehago las fotos o bajo el precio", "why": "Un artículo parado es dinero bloqueado. Mejor que el stock gire.", "source": "Rotación de stock"}}'::jsonb),
  ('trading_plan', 'business', '{revenu}', '{}', '{business,mixte}', '{trading}', '{}', '{}', 'Si j''ouvre une position', 'alors j''écris avant : entrée, stop, objectif', 'declaratif', 2, '{1,2,3,4,5,6,7}', '{}', 'Un plan écrit à froid te protège des décisions prises sous le coup de l''émotion.', 'Gestion du risque', 78, '{"en": {"if_text": "If I open a position", "then_text": "I write it down first: entry, stop, target", "why": "A plan written in advance protects you from emotional decisions.", "source": "Risk management"}, "de": {"if_text": "Wenn ich eine Position eröffne", "then_text": "schreibe ich vorher auf: Einstieg, Stop, Ziel", "why": "Ein vorher geschriebener Plan schützt dich vor emotionalen Entscheidungen.", "source": "Risikomanagement"}, "es": {"if_text": "Si abro una posición", "then_text": "escribo antes: entrada, stop, objetivo", "why": "Un plan escrito en frío te protege de las decisiones tomadas en caliente.", "source": "Gestión del riesgo"}}'::jsonb),
  ('trading_journal', 'business', '{revenu}', '{dispersion,regularite}', '{business,mixte}', '{trading}', '{}', '{}', 'Si je ferme une position', 'alors je la note dans mon journal de trading, avec une capture', 'capture', 1, '{1,2,3,4,5}', '{}', 'Sans journal, tu répètes les mêmes erreurs sans les voir.', 'Journal de trading', 79, '{"en": {"if_text": "If I close a position", "then_text": "I log it in my trading journal, with a screenshot", "why": "Without a journal, you repeat the same mistakes without seeing them.", "source": "Trading journal"}, "de": {"if_text": "Wenn ich eine Position schließe", "then_text": "trage ich sie mit Screenshot in mein Trading-Journal ein", "why": "Ohne Journal wiederholst du dieselben Fehler, ohne sie zu sehen.", "source": "Trading-Journal"}, "es": {"if_text": "Si cierro una posición", "then_text": "la anoto en mi diario de trading, con una captura", "why": "Sin diario repites los mismos errores sin verlos.", "source": "Diario de trading"}}'::jsonb),
  ('trading_stop', 'esprit', '{revenu}', '{regularite}', '{business,mixte}', '{trading}', '{}', '{}', 'Si je perds 2 trades d''affilée', 'alors j''arrête pour la journée', 'declaratif', 2, '{1,2,3,4,5}', '{}', 'Après deux pertes, vouloir se refaire coûte plus cher que la perte elle-même.', 'Psychologie du trading', 80, '{"en": {"if_text": "If I lose 2 trades in a row", "then_text": "I stop for the day", "why": "After two losses, trying to win it back costs more than the loss itself.", "source": "Trading psychology"}, "de": {"if_text": "Wenn ich 2 Trades in Folge verliere", "then_text": "höre ich für heute auf", "why": "Nach zwei Verlusten kostet der Versuch, es zurückzuholen, mehr als der Verlust selbst.", "source": "Trading-Psychologie"}, "es": {"if_text": "Si pierdo 2 operaciones seguidas", "then_text": "paro por hoy", "why": "Tras dos pérdidas, querer recuperarte cuesta más que la propia pérdida.", "source": "Psicología del trading"}}'::jsonb),
  ('trading_risque', 'business', '{revenu}', '{}', '{business,mixte}', '{trading}', '{}', '{}', 'Si je prends une position', 'alors je ne risque pas plus de 1 % de mon capital', 'declaratif', 2, '{1,2,3,4,5}', '{}', 'Survivre d''abord : un petit risque par trade te laisse le temps d''apprendre.', 'Gestion du risque', 81, '{"en": {"if_text": "If I take a position", "then_text": "I risk no more than 1% of my capital", "why": "Survive first: a small risk per trade gives you time to learn.", "source": "Risk management"}, "de": {"if_text": "Wenn ich eine Position eingehe", "then_text": "riskiere ich höchstens 1 % meines Kapitals", "why": "Erst überleben: Ein kleines Risiko pro Trade gibt dir Zeit zu lernen.", "source": "Risikomanagement"}, "es": {"if_text": "Si tomo una posición", "then_text": "no arriesgo más del 1 % de mi capital", "why": "Primero sobrevivir: un riesgo pequeño por operación te da tiempo para aprender.", "source": "Gestión del riesgo"}}'::jsonb),
  ('trading_revue', 'esprit', '{revenu}', '{dispersion}', '{business,mixte}', '{trading}', '{}', '{}', 'Si c''est samedi', 'alors je relis mon journal de la semaine et je choisis une seule règle à améliorer', 'photo', 1, '{6}', '{}', 'Une amélioration par semaine, c''est cinquante par an.', 'Amélioration continue', 82, '{"en": {"if_text": "If it''s Saturday", "then_text": "I reread my journal for the week and pick one rule to improve", "why": "One improvement a week is fifty a year.", "source": "Continuous improvement"}, "de": {"if_text": "Wenn Samstag ist", "then_text": "lese ich mein Journal der Woche und wähle eine einzige Regel zum Verbessern", "why": "Eine Verbesserung pro Woche sind fünfzig im Jahr.", "source": "Kontinuierliche Verbesserung"}, "es": {"if_text": "Si es sábado", "then_text": "releo mi diario de la semana y elijo una sola regla que mejorar", "why": "Una mejora por semana son cincuenta al año.", "source": "Mejora continua"}}'::jsonb),
  ('immo_appels', 'business', '{revenu,clients}', '{vente}', '{business,mixte}', '{immobilier}', '{}', '{trading}', 'Si c''est un jour de semaine', 'alors 10 appels à des propriétaires, des agences ou des vendeurs', 'declaratif', 2, '{1,2,3,4,5}', '{}', 'Les bonnes affaires ne viennent pas à toi : elles se trouvent au téléphone.', 'Prospection immobilière', 83, '{"en": {"if_text": "If it''s a weekday", "then_text": "10 calls to owners, agencies or sellers", "why": "Good deals don''t come to you: you find them on the phone.", "source": "Real estate prospecting"}, "de": {"if_text": "Wenn Werktag ist", "then_text": "10 Anrufe bei Eigentümern, Maklern oder Verkäufern", "why": "Gute Deals kommen nicht zu dir: Man findet sie am Telefon.", "source": "Immobilien-Akquise"}, "es": {"if_text": "Si es día laborable", "then_text": "10 llamadas a propietarios, agencias o vendedores", "why": "Los buenos negocios no vienen a ti: se encuentran al teléfono.", "source": "Prospección inmobiliaria"}}'::jsonb),
  ('immo_calcul', 'business', '{revenu}', '{}', '{business,mixte}', '{immobilier}', '{}', '{}', 'Si je visite un bien', 'alors je fais le calcul de rentabilité le jour même', 'capture', 1, '{1,2,3,4,5,6,7}', '{}', 'Les chiffres décident, pas le coup de cœur.', 'Investissement locatif', 84, '{"en": {"if_text": "If I visit a property", "then_text": "I run the yield calculation the same day", "why": "Numbers decide, not love at first sight.", "source": "Rental investment"}, "de": {"if_text": "Wenn ich eine Immobilie besichtige", "then_text": "rechne ich noch am selben Tag die Rendite durch", "why": "Zahlen entscheiden, nicht das Bauchgefühl.", "source": "Mietinvestment"}, "es": {"if_text": "Si visito un inmueble", "then_text": "hago el cálculo de rentabilidad el mismo día", "why": "Deciden los números, no el flechazo.", "source": "Inversión en alquiler"}}'::jsonb),
  ('coaching_contenu', 'business', '{audience,clients}', '{regularite}', '{business,mixte}', '{coaching}', '{}', '{}', 'Si c''est un jour de semaine', 'alors un contenu qui répond à une vraie question de mes clients', 'lien', 2, '{1,2,3,4,5}', '{}', 'Répondre aux questions de tes clients montre ton expertise mieux qu''une publicité.', 'Marketing de contenu', 85, '{"en": {"if_text": "If it''s a weekday", "then_text": "one post answering a real question from my clients", "why": "Answering your clients'' questions shows your expertise better than an ad.", "source": "Content marketing"}, "de": {"if_text": "Wenn Werktag ist", "then_text": "ein Beitrag, der eine echte Frage meiner Kunden beantwortet", "why": "Kundenfragen zu beantworten zeigt deine Expertise besser als Werbung.", "source": "Content-Marketing"}, "es": {"if_text": "Si es día laborable", "then_text": "un contenido que responde a una pregunta real de mis clientes", "why": "Responder a las preguntas de tus clientes muestra tu experiencia mejor que un anuncio.", "source": "Marketing de contenidos"}}'::jsonb),
  ('local_avis', 'business', '{clients,revenu}', '{vente}', '{business,mixte}', '{service_local}', '{}', '{trading}', 'Si un client repart content', 'alors je lui demande un avis en ligne', 'declaratif', 1, '{1,2,3,4,5,6,7}', '{}', 'Les avis en ligne font venir les prochains clients du quartier.', 'Commerce local', 86, '{"en": {"if_text": "If a customer leaves happy", "then_text": "I ask them for an online review", "why": "Online reviews bring the next local customers.", "source": "Local business"}, "de": {"if_text": "Wenn ein Kunde zufrieden geht", "then_text": "bitte ich ihn um eine Online-Bewertung", "why": "Online-Bewertungen bringen die nächsten Kunden aus der Umgebung.", "source": "Lokales Geschäft"}, "es": {"if_text": "Si un cliente se va contento", "then_text": "le pido una reseña en internet", "why": "Las reseñas en internet atraen a los próximos clientes del barrio.", "source": "Comercio local"}}'::jsonb),
  ('local_photo', 'business', '{clients,audience}', '{regularite}', '{business,mixte}', '{service_local}', '{}', '{}', 'Si c''est lundi, mercredi ou vendredi', 'alors je publie une photo de mon travail', 'lien', 1, '{1,3,5}', '{}', 'Montrer ton travail régulièrement te rend visible là où tes clients regardent.', 'Visibilité locale', 87, '{"en": {"if_text": "If it''s Monday, Wednesday or Friday", "then_text": "I post a photo of my work", "why": "Showing your work regularly makes you visible where your customers look.", "source": "Local visibility"}, "de": {"if_text": "Wenn Montag, Mittwoch oder Freitag ist", "then_text": "poste ich ein Foto meiner Arbeit", "why": "Deine Arbeit regelmäßig zu zeigen macht dich sichtbar, wo deine Kunden hinschauen.", "source": "Lokale Sichtbarkeit"}, "es": {"if_text": "Si es lunes, miércoles o viernes", "then_text": "publico una foto de mi trabajo", "why": "Enseñar tu trabajo con regularidad te hace visible donde miran tus clientes.", "source": "Visibilidad local"}}'::jsonb),
  ('lycee_devoirs', 'focus', '{examens}', '{telephone,procrastination}', '{etudes,mixte}', '{}', '{lycee,bts_but}', '{}', 'Si je rentre des cours', 'alors 50 minutes de devoirs avant le téléphone', 'session', 2, '{1,2,3,4,5}', '{"minutes":50}', 'Le téléphone d''abord, et la soirée y passe. Les devoirs d''abord, et elle est libre.', 'Gestion du temps', 90, '{"en": {"if_text": "If I get home from class", "then_text": "50 minutes of homework before my phone", "why": "Phone first, and the evening disappears. Homework first, and it''s free.", "source": "Time management"}, "de": {"if_text": "Wenn ich vom Unterricht nach Hause komme", "then_text": "50 Minuten Hausaufgaben vor dem Handy", "why": "Erst das Handy, und der Abend ist weg. Erst die Hausaufgaben, und er gehört dir.", "source": "Zeitmanagement"}, "es": {"if_text": "Si vuelvo de clase", "then_text": "50 minutos de deberes antes del móvil", "why": "Primero el móvil, y la tarde se va. Primero los deberes, y queda libre.", "source": "Gestión del tiempo"}}'::jsonb),
  ('controle_test', 'focus', '{examens}', '{procrastination}', '{etudes,mixte}', '{}', '{lycee,bts_but,universite}', '{}', 'Si j''ai un contrôle dans la semaine', 'alors je fais un exercice type sans regarder la correction', 'photo', 2, '{1,2,3,4,5}', '{}', 'S''entraîner dans les conditions du contrôle prépare mieux que relire.', 'Effet de test', 91, '{"en": {"if_text": "If I have a test this week", "then_text": "I do a typical exercise without looking at the answers", "why": "Practising under test conditions prepares you better than rereading.", "source": "Testing effect"}, "de": {"if_text": "Wenn ich diese Woche einen Test habe", "then_text": "mache ich eine typische Aufgabe, ohne in die Lösung zu schauen", "why": "Unter Testbedingungen zu üben bereitet besser vor als Wiederlesen.", "source": "Testeffekt"}, "es": {"if_text": "Si tengo un examen esta semana", "then_text": "hago un ejercicio tipo sin mirar la solución", "why": "Practicar en condiciones de examen prepara mejor que releer.", "source": "Efecto de prueba"}}'::jsonb),
  ('prepa_ds', 'focus', '{examens}', '{}', '{etudes,mixte}', '{}', '{prepa}', '{}', 'Si c''est samedi', 'alors un sujet d''entraînement en temps réel, sans aide', 'session', 3, '{6}', '{"minutes":90}', 'Les concours se gagnent à l''entraînement en conditions réelles.', 'Préparation aux concours', 92, '{"en": {"if_text": "If it''s Saturday", "then_text": "one practice paper in real time, no help", "why": "Competitive exams are won by practising in real conditions.", "source": "Exam preparation"}, "de": {"if_text": "Wenn Samstag ist", "then_text": "eine Übungsklausur in Echtzeit, ohne Hilfe", "why": "Auswahlprüfungen gewinnt man durch Training unter echten Bedingungen.", "source": "Prüfungsvorbereitung"}, "es": {"if_text": "Si es sábado", "then_text": "un examen de práctica en tiempo real, sin ayuda", "why": "Las oposiciones y concursos se ganan entrenando en condiciones reales.", "source": "Preparación de exámenes"}}'::jsonb),
  ('prepa_colle', 'esprit', '{examens}', '{}', '{etudes,mixte}', '{}', '{prepa}', '{}', 'Si j''ai une colle demain', 'alors je prépare 3 questions de cours ce soir', 'declaratif', 1, '{1,2,3,4,5}', '{}', 'Arriver préparé transforme une colle en entraînement, pas en épreuve.', 'Préparation aux oraux', 93, '{"en": {"if_text": "If I have an oral exam tomorrow", "then_text": "I prepare 3 course questions tonight", "why": "Arriving prepared turns an oral into practice, not an ordeal.", "source": "Oral exam preparation"}, "de": {"if_text": "Wenn ich morgen eine mündliche Prüfung habe", "then_text": "bereite ich heute Abend 3 Fragen zum Stoff vor", "why": "Vorbereitet zu kommen macht die Prüfung zum Training, nicht zur Tortur.", "source": "Vorbereitung mündlicher Prüfungen"}, "es": {"if_text": "Si mañana tengo un oral", "then_text": "preparo esta noche 3 preguntas del temario", "why": "Llegar preparado convierte un oral en entrenamiento, no en una prueba.", "source": "Preparación de orales"}}'::jsonb),
  ('fac_relecture', 'esprit', '{examens}', '{procrastination}', '{etudes,mixte}', '{}', '{universite,commerce,ingenieur}', '{}', 'Si un cours est fini', 'alors je le relis et j''écris 3 questions dans les 24 heures', 'photo', 1, '{1,2,3,4,5}', '{}', 'Revoir un cours dans les 24 heures limite fortement l''oubli.', 'Courbe de l''oubli (Ebbinghaus)', 94, '{"en": {"if_text": "If a class is over", "then_text": "I review it and write 3 questions within 24 hours", "why": "Reviewing a class within 24 hours sharply limits forgetting.", "source": "The forgetting curve (Ebbinghaus)"}, "de": {"if_text": "Wenn eine Vorlesung vorbei ist", "then_text": "gehe ich sie durch und schreibe innerhalb von 24 Stunden 3 Fragen", "why": "Den Stoff innerhalb von 24 Stunden zu wiederholen, bremst das Vergessen stark.", "source": "Vergessenskurve (Ebbinghaus)"}, "es": {"if_text": "Si termina una clase", "then_text": "la repaso y escribo 3 preguntas en menos de 24 horas", "why": "Repasar una clase en las 24 horas siguientes limita mucho el olvido.", "source": "Curva del olvido (Ebbinghaus)"}}'::jsonb),
  ('fac_presence', 'focus', '{examens}', '{telephone}', '{etudes,mixte}', '{}', '{universite,commerce,ingenieur,bts_but}', '{}', 'Si j''ai cours', 'alors j''y vais, téléphone rangé, et je prends mes notes à la main', 'declaratif', 1, '{1,2,3,4,5}', '{}', 'Écrire à la main oblige à reformuler, donc à comprendre.', 'Mueller et Oppenheimer, 2014', 95, '{"en": {"if_text": "If I have class", "then_text": "I go, phone away, and take notes by hand", "why": "Writing by hand forces you to rephrase, and so to understand.", "source": "Mueller and Oppenheimer, 2014"}, "de": {"if_text": "Wenn ich Vorlesung habe", "then_text": "gehe ich hin, Handy weg, und schreibe von Hand mit", "why": "Von Hand zu schreiben zwingt zum Umformulieren und damit zum Verstehen.", "source": "Mueller und Oppenheimer, 2014"}, "es": {"if_text": "Si tengo clase", "then_text": "voy, con el móvil guardado, y tomo apuntes a mano", "why": "Escribir a mano obliga a reformular, y por tanto a entender.", "source": "Mueller y Oppenheimer, 2014"}}'::jsonb),
  ('ecole_reseau', 'business', '{clients,lancement,autre}', '{vente}', '{etudes,mixte}', '{}', '{commerce,ingenieur,bts_but}', '{}', 'Si c''est un jour de semaine', 'alors je contacte un professionnel de mon secteur', 'declaratif', 1, '{1,2,3,4,5}', '{}', 'Les stages, les alternances et les premiers postes passent souvent par le réseau.', 'Réseau professionnel', 96, '{"en": {"if_text": "If it''s a weekday", "then_text": "I reach out to a professional in my field", "why": "Internships, work-study placements and first jobs often come through your network.", "source": "Professional network"}, "de": {"if_text": "Wenn Werktag ist", "then_text": "kontaktiere ich jemanden aus meiner Branche", "why": "Praktika, duale Plätze und erste Jobs kommen oft über das Netzwerk.", "source": "Berufliches Netzwerk"}, "es": {"if_text": "Si es día laborable", "then_text": "contacto con un profesional de mi sector", "why": "Las prácticas, la formación dual y los primeros empleos suelen llegar por contactos.", "source": "Red profesional"}}'::jsonb),
  ('projet_groupe', 'esprit', '{examens}', '{dispersion}', '{etudes,mixte}', '{}', '{commerce,ingenieur,universite}', '{}', 'Si on me donne un travail de groupe', 'alors je propose un planning partagé le jour même', 'declaratif', 1, '{1,2,3,4,5,6,7}', '{}', 'Le groupe qui s''organise tôt est celui qui ne finit pas en panique.', 'Gestion de projet', 97, '{"en": {"if_text": "If I''m given a group project", "then_text": "I suggest a shared schedule the same day", "why": "The group that organises early is the one that doesn''t end in panic.", "source": "Project management"}, "de": {"if_text": "Wenn ich eine Gruppenarbeit bekomme", "then_text": "schlage ich noch am selben Tag einen gemeinsamen Zeitplan vor", "why": "Die Gruppe, die sich früh organisiert, endet nicht in Panik.", "source": "Projektmanagement"}, "es": {"if_text": "Si me ponen un trabajo en grupo", "then_text": "propongo un calendario compartido el mismo día", "why": "El grupo que se organiza pronto es el que no acaba con prisas.", "source": "Gestión de proyectos"}}'::jsonb),
  ('blocage_aide', 'focus', '{examens,lancement}', '{procrastination}', '{etudes,business,mixte}', '{saas}', '{ingenieur,universite,prepa}', '{}', 'Si je bloque plus de 30 minutes sur un problème', 'alors je demande de l''aide', 'declaratif', 1, '{1,2,3,4,5,6,7}', '{}', 'Bloquer seul pendant des heures n''est pas du courage : c''est du temps perdu.', 'Apprentissage', 98, '{"en": {"if_text": "If I''m stuck on a problem for more than 30 minutes", "then_text": "I ask for help", "why": "Being stuck alone for hours isn''t courage: it''s wasted time.", "source": "Learning"}, "de": {"if_text": "Wenn ich länger als 30 Minuten an einem Problem hänge", "then_text": "frage ich um Hilfe", "why": "Stundenlang allein festzustecken ist kein Mut: Es ist verlorene Zeit.", "source": "Lernen"}, "es": {"if_text": "Si llevo más de 30 minutos atascado en un problema", "then_text": "pido ayuda", "why": "Atascarse solo durante horas no es valentía: es tiempo perdido.", "source": "Aprendizaje"}}'::jsonb),
  ('alternance_journal', 'esprit', '{autre,examens}', '{}', '{etudes,mixte}', '{}', '{bts_but,commerce,ingenieur}', '{}', 'Si je suis en stage ou en alternance', 'alors j''écris ce que j''ai appris aujourd''hui', 'declaratif', 1, '{1,2,3,4,5}', '{}', 'Ce que tu notes, tu le retiens, et tu pourras le valoriser en entretien.', 'Apprentissage par l''expérience', 99, '{"en": {"if_text": "If I''m on an internship or work-study day", "then_text": "I write down what I learned today", "why": "What you write down, you remember, and you can use it in interviews.", "source": "Learning by doing"}, "de": {"if_text": "Wenn ich im Praktikum oder im Betrieb bin", "then_text": "schreibe ich auf, was ich heute gelernt habe", "why": "Was du aufschreibst, behältst du, und du kannst es im Vorstellungsgespräch nutzen.", "source": "Lernen durch Erfahrung"}, "es": {"if_text": "Si estoy de prácticas o en formación dual", "then_text": "escribo lo que he aprendido hoy", "why": "Lo que apuntas, lo recuerdas, y podrás aprovecharlo en una entrevista.", "source": "Aprender haciendo"}}'::jsonb),
  ('note_carnet', 'esprit', '{examens}', '{regularite}', '{etudes,mixte}', '{}', '{}', '{}', 'Si je reçois une note', 'alors je l''ajoute à mon carnet de notes, avec une capture', 'capture', 1, '{1,2,3,4,5,6,7}', '{}', 'Suivre ses notes montre la tendance avant les résultats finaux.', 'Suivi des progrès', 100, '{"en": {"if_text": "If I get a grade", "then_text": "I add it to my grade book, with a screenshot", "why": "Tracking your grades shows the trend before the final results.", "source": "Progress tracking"}, "de": {"if_text": "Wenn ich eine Note bekomme", "then_text": "trage ich sie mit Screenshot in mein Notenheft ein", "why": "Deine Noten zu verfolgen zeigt den Trend vor den Endergebnissen.", "source": "Fortschrittskontrolle"}, "es": {"if_text": "Si recibo una nota", "then_text": "la añado a mi cuaderno de notas, con una captura", "why": "Seguir tus notas muestra la tendencia antes de los resultados finales.", "source": "Seguimiento del progreso"}}'::jsonb),
  ('notifs_coupees', 'focus', '{}', '{telephone,dispersion}', '{etudes,business,mixte}', '{}', '{}', '{}', 'Si je commence à travailler', 'alors mode Ne pas déranger et une seule fenêtre ouverte', 'declaratif', 1, '{1,2,3,4,5}', '{}', 'Chaque notification coûte plusieurs minutes de concentration.', 'Recherche sur les interruptions (Gloria Mark)', 101, '{"en": {"if_text": "If I start working", "then_text": "Do Not Disturb on and a single window open", "why": "Every notification costs several minutes of focus.", "source": "Research on interruptions (Gloria Mark)"}, "de": {"if_text": "Wenn ich anfange zu arbeiten", "then_text": "„Nicht stören“ an und nur ein Fenster offen", "why": "Jede Benachrichtigung kostet mehrere Minuten Konzentration.", "source": "Forschung zu Unterbrechungen (Gloria Mark)"}, "es": {"if_text": "Si empiezo a trabajar", "then_text": "modo No molestar y una sola ventana abierta", "why": "Cada notificación cuesta varios minutos de concentración.", "source": "Investigación sobre interrupciones (Gloria Mark)"}}'::jsonb),
  ('ecrans_off', 'energie', '{}', '{reveil,telephone}', '{etudes,business,mixte}', '{}', '{}', '{}', 'S''il est 23 h', 'alors écrans éteints, je vais me coucher', 'declaratif', 1, '{1,2,3,4,5,6,7}', '{}', 'Un coucher régulier, c''est un réveil facile et une journée plus efficace.', 'Hygiène du sommeil', 102, '{"en": {"if_text": "If it''s 23:00", "then_text": "screens off, I go to bed", "why": "A regular bedtime means an easy wake-up and a more productive day.", "source": "Sleep hygiene"}, "de": {"if_text": "Wenn es 23 Uhr ist", "then_text": "Bildschirme aus, ich gehe ins Bett", "why": "Regelmäßig schlafen gehen heißt leicht aufstehen und produktiver sein.", "source": "Schlafhygiene"}, "es": {"if_text": "Si son las 23:00", "then_text": "pantallas apagadas, me voy a dormir", "why": "Acostarte a una hora fija es despertar fácil y un día más productivo.", "source": "Higiene del sueño"}}'::jsonb),
  ('cafe_14h', 'energie', '{}', '{reveil}', '{etudes,business,mixte}', '{}', '{}', '{}', 'Si c''est l''après-midi', 'alors plus de café après 14 h', 'declaratif', 1, '{1,2,3,4,5,6,7}', '{}', 'La caféine reste des heures dans le corps et abîme le sommeil.', 'Physiologie du sommeil', 103, '{"en": {"if_text": "If it''s the afternoon", "then_text": "no more coffee after 14:00", "why": "Caffeine stays in your body for hours and hurts your sleep.", "source": "Sleep physiology"}, "de": {"if_text": "Wenn es Nachmittag ist", "then_text": "kein Kaffee mehr nach 14 Uhr", "why": "Koffein bleibt stundenlang im Körper und stört den Schlaf.", "source": "Schlafphysiologie"}, "es": {"if_text": "Si es por la tarde", "then_text": "nada de café después de las 14:00", "why": "La cafeína se queda horas en el cuerpo y estropea el sueño.", "source": "Fisiología del sueño"}}'::jsonb),
  ('marche_midi', 'corps', '{}', '{sport}', '{etudes,business,mixte}', '{}', '{}', '{}', 'Si c''est l''heure du déjeuner', 'alors 15 minutes de marche', 'declaratif', 1, '{1,2,3,4,5}', '{}', 'Marcher après le repas relance l''énergie de l''après-midi.', 'Activité physique', 104, '{"en": {"if_text": "If it''s lunchtime", "then_text": "a 15-minute walk", "why": "Walking after a meal boosts your afternoon energy.", "source": "Physical activity"}, "de": {"if_text": "Wenn Mittagszeit ist", "then_text": "15 Minuten spazieren gehen", "why": "Nach dem Essen zu gehen gibt Energie für den Nachmittag.", "source": "Bewegung"}, "es": {"if_text": "Si es la hora de comer", "then_text": "15 minutos caminando", "why": "Caminar después de comer reactiva la energía de la tarde.", "source": "Actividad física"}}'::jsonb),
  ('pause_pompes', 'corps', '{corps}', '{sport}', '{etudes,business,mixte}', '{}', '{}', '{}', 'Si je fais une pause', 'alors {reps} pompes', 'reps', 1, '{1,2,3,4,5}', '{"exercise":"pushup","reps":10}', 'Quelques pompes entre deux sessions valent mieux qu''un écran.', 'Pauses actives', 105, '{"en": {"if_text": "If I take a break", "then_text": "{reps} push-ups", "why": "A few push-ups between two sessions beat a screen.", "source": "Active breaks"}, "de": {"if_text": "Wenn ich eine Pause mache", "then_text": "{reps} Liegestütze", "why": "Ein paar Liegestütze zwischen zwei Sessions sind besser als ein Bildschirm.", "source": "Aktive Pausen"}, "es": {"if_text": "Si hago una pausa", "then_text": "{reps} flexiones", "why": "Unas flexiones entre dos sesiones valen más que una pantalla.", "source": "Pausas activas"}}'::jsonb),
  ('vider_tete', 'esprit', '{}', '{dispersion}', '{etudes,business,mixte}', '{}', '{}', '{}', 'Si je me sens dispersé', 'alors j''écris tout ce que j''ai en tête, puis je choisis une seule chose', 'declaratif', 1, '{1,2,3,4,5,6,7}', '{}', 'Sortir les idées de ta tête libère ton attention pour ce qui compte.', 'David Allen, Getting Things Done', 106, '{"en": {"if_text": "If I feel scattered", "then_text": "I write down everything on my mind, then pick one single thing", "why": "Getting ideas out of your head frees your attention for what matters.", "source": "David Allen, Getting Things Done"}, "de": {"if_text": "Wenn ich mich verzettelt fühle", "then_text": "schreibe ich alles auf, was mir im Kopf herumgeht, und wähle dann eine einzige Sache", "why": "Gedanken aus dem Kopf zu holen macht die Aufmerksamkeit frei für das Wichtige.", "source": "David Allen, Getting Things Done"}, "es": {"if_text": "Si me siento disperso", "then_text": "escribo todo lo que tengo en la cabeza y elijo una sola cosa", "why": "Sacar las ideas de tu cabeza libera tu atención para lo que importa.", "source": "David Allen, Getting Things Done"}}'::jsonb),
  ('trois_victoires', 'esprit', '{}', '{regularite}', '{etudes,business,mixte}', '{}', '{}', '{}', 'Si ma journée se termine', 'alors j''écris 3 choses qui ont avancé aujourd''hui', 'declaratif', 1, '{1,2,3,4,5,6,7}', '{}', 'Voir ses progrès entretient la motivation sur la durée.', 'Teresa Amabile, le principe du progrès', 107, '{"en": {"if_text": "If my day is ending", "then_text": "I write down 3 things that moved forward today", "why": "Seeing your progress keeps motivation going over time.", "source": "Teresa Amabile, the progress principle"}, "de": {"if_text": "Wenn mein Tag endet", "then_text": "schreibe ich 3 Dinge auf, die heute vorangekommen sind", "why": "Fortschritte zu sehen hält die Motivation auf Dauer am Leben.", "source": "Teresa Amabile, das Fortschrittsprinzip"}, "es": {"if_text": "Si termina mi día", "then_text": "escribo 3 cosas que han avanzado hoy", "why": "Ver tus avances mantiene la motivación a largo plazo.", "source": "Teresa Amabile, el principio del progreso"}}'::jsonb)
on conflict (code) do update set
  pillar = excluded.pillar, goal_types = excluded.goal_types, weak_points = excluded.weak_points,
  categories = excluded.categories, business_types = excluded.business_types, schools = excluded.schools,
  not_for = excluded.not_for, if_text = excluded.if_text, then_text = excluded.then_text,
  proof_type = excluded.proof_type, difficulty = excluded.difficulty, days = excluded.days, target = excluded.target,
  why = excluded.why, source = excluded.source, sort = excluded.sort, i18n = excluded.i18n;

-- Gabarits existants : textes plus clairs et ciblage métier.
update public.principle_templates set then_text = 'alors je me lève tout de suite, sans répéter l''alarme' where code = 'reveil_fixe';
update public.principle_templates set i18n = jsonb_set(i18n, '{en,then_text}', to_jsonb('I get up right away, no snooze'::text)) where code = 'reveil_fixe';
update public.principle_templates set i18n = jsonb_set(i18n, '{de,then_text}', to_jsonb('stehe ich sofort auf, ohne Schlummertaste'::text)) where code = 'reveil_fixe';
update public.principle_templates set i18n = jsonb_set(i18n, '{es,then_text}', to_jsonb('me levanto al momento, sin posponer la alarma'::text)) where code = 'reveil_fixe';
update public.principle_templates set then_text = 'alors 90 minutes sur une seule fonctionnalité, jusqu''à la mettre en ligne' where code = 'livrer';
update public.principle_templates set business_types = '{saas}' where code = 'livrer';
update public.principle_templates set categories = '{business,mixte}' where code = 'livrer';
update public.principle_templates set i18n = jsonb_set(i18n, '{en,then_text}', to_jsonb('90 minutes on a single feature, until it''s live'::text)) where code = 'livrer';
update public.principle_templates set i18n = jsonb_set(i18n, '{de,then_text}', to_jsonb('90 Minuten an einer einzigen Funktion, bis sie online ist'::text)) where code = 'livrer';
update public.principle_templates set i18n = jsonb_set(i18n, '{es,then_text}', to_jsonb('90 minutos en una sola funcionalidad, hasta publicarla'::text)) where code = 'livrer';
update public.principle_templates set business_types = '{agence,coaching,service_local,saas,immobilier}' where code = 'prospection';
update public.principle_templates set not_for = '{trading,revente}' where code = 'prospection';
update public.principle_templates set business_types = '{agence,coaching,service_local,saas,immobilier}' where code = 'appel_prospect';
update public.principle_templates set not_for = '{trading}' where code = 'appel_prospect';
update public.principle_templates set business_types = '{agence,coaching,service_local,immobilier}' where code = 'relance';
update public.principle_templates set not_for = '{trading}' where code = 'relance';
update public.principle_templates set business_types = '{agence,coaching,service_local,immobilier,saas}' where code = 'demander_vente';
update public.principle_templates set not_for = '{trading}' where code = 'demander_vente';
update public.principle_templates set business_types = '{agence,coaching,saas,ecommerce}' where code = 'offre';
update public.principle_templates set not_for = '{trading,revente}' where code = 'offre';
update public.principle_templates set business_types = '{contenu,coaching,saas,service_local}' where code = 'publier_contenu';
update public.principle_templates set business_types = '{contenu}' where code = 'contenu_quotidien';
update public.principle_templates set business_types = '{ecommerce,contenu,saas,revente}' where code = 'chiffres_jour';
update public.principle_templates set business_types = '{ecommerce,agence,revente,trading,service_local,coaching,saas}' where code = 'revue_revenus';
update public.principle_templates set schools = '{universite,prepa,commerce,ingenieur,bts_but,lycee}' where code = 'revision_active';
update public.principle_templates set schools = '{lycee,universite,bts_but}' where code = 'devoir_jour_meme';
update public.principle_templates set schools = '{lycee,prepa,universite,bts_but}' where code = 'fiches';


-- Gabarits possibles pour un joueur, avec leur note : métier ou école +8 (+4 si le gabarit est propre à ce métier),
-- objectif +5, point faible +3.
create or replace function public._template_candidates(
  p_category text, p_goal_type text, p_weak text[], p_pushups text, p_business text[], p_school text
) returns table (code text, pillar text, biz boolean, stu boolean, score int, sort int, types text[])
language sql stable set search_path = '' as $$
  select t.code, t.pillar,
    t.business_types && coalesce(p_business, '{}'),
    p_school is not null and p_school = any(t.schools),
    ((case when t.business_types && coalesce(p_business, '{}') then 8 + (case when cardinality(t.business_types) <= 2 then 4 else 0 end) else 0 end)
    + (case when p_school is not null and p_school = any(t.schools) then 8 + (case when cardinality(t.schools) <= 2 then 4 else 0 end) else 0 end)
    + (case when p_goal_type = any(t.goal_types) then 5 else 0 end)
    + 3 * (select count(*) from unnest(t.weak_points) w where w = any(coalesce(p_weak, '{}')))
    - (case when cardinality(t.business_types) > 0 and cardinality(coalesce(p_business, '{}')) > 0
        and not (t.business_types && coalesce(p_business, '{}')) then 4 else 0 end)
    - (case when cardinality(t.schools) > 0 and p_school is not null and not (p_school = any(t.schools)) then 4 else 0 end))::int,
    t.sort,
    array(select x from unnest(t.business_types) x where x = any(coalesce(p_business, '{}')))
  from public.principle_templates t
  where p_category = any(t.categories)
    -- Exclu seulement si toutes les activités du joueur sont exclues (trading seul : pas de prospection).
    and not (cardinality(coalesce(p_business, '{}')) > 0 and coalesce(p_business, '{}') <@ t.not_for)
    and t.code not in ('reveil_fixe', 'bloc_profond', 'pompes', 'squats', 'salle')
    and (t.pillar <> 'corps' or p_pushups <> 'non' or p_goal_type = 'corps');
$$;

-- Choix des 6 principes : réveil et travail profond, puis le sport seulement s'il est voulu, puis les principes
-- du métier (au moins un par activité choisie) et de l'école en priorité, enfin les mieux notés (objectif, points faibles).
drop function if exists public._pick_templates(text, text, text[], text);
create or replace function public._pick_templates(
  p_category text, p_goal_type text, p_weak text[], p_pushups text, p_business text[], p_school text
) returns text[]
language plpgsql stable set search_path = '' as $$
declare
  v_codes text[] := array['reveil_fixe', 'bloc_profond'];
  v_pillars text[] := array['energie', 'focus'];
  v_business text[] := coalesce(p_business, '{}');
  v_want_biz int := case p_category
    when 'business' then least(3, greatest(2, cardinality(coalesce(p_business, '{}'))))
    when 'mixte' then least(2, greatest(1, cardinality(coalesce(p_business, '{}'))))
    else 0 end;
  v_want_stu int := case p_category when 'etudes' then 2 when 'mixte' then 1 else 0 end;
  v_targets text[];
  v_covered text[] := '{}';
  v_biz int := 0;
  v_stu int := 0;
  v_cap int;
  r record;
begin
  if p_pushups = 'oui' then
    v_codes := v_codes || 'pompes'::text; v_pillars := v_pillars || 'corps'::text;
  elsif p_pushups = 'quelques' then
    v_codes := v_codes || 'pompes'::text; v_pillars := v_pillars || 'corps'::text;
  elsif p_goal_type = 'corps' then
    v_codes := v_codes || 'salle'::text; v_pillars := v_pillars || 'corps'::text;
  end if;

  -- Activités du joueur pour lesquelles il existe au moins un gabarit (« autre » n'en a pas).
  select coalesce(array_agg(distinct x), '{}') into v_targets
  from public._template_candidates(p_category, p_goal_type, p_weak, p_pushups, v_business, p_school) c, unnest(c.types) x;

  -- 1. Le métier et l'école d'abord : chaque activité choisie a au moins un principe.
  for r in select * from public._template_candidates(p_category, p_goal_type, p_weak, p_pushups, v_business, p_school) c order by c.score desc, c.sort loop
    exit when cardinality(v_codes) >= 6;
    if r.biz and v_biz < v_want_biz and (v_targets <@ v_covered or not (r.types <@ v_covered)) then
      v_codes := v_codes || r.code; v_pillars := v_pillars || r.pillar; v_biz := v_biz + 1; v_covered := v_covered || r.types;
    elsif r.stu and v_stu < v_want_stu then
      v_codes := v_codes || r.code; v_pillars := v_pillars || r.pillar; v_stu := v_stu + 1;
    end if;
  end loop;

  -- 2. Puis les mieux notés, sans trop de principes sur un même pilier.
  for r in select * from public._template_candidates(p_category, p_goal_type, p_weak, p_pushups, v_business, p_school) c
    where c.code <> all(v_codes) order by c.score desc, c.sort loop
    exit when cardinality(v_codes) >= 6;
    continue when r.score <= 0;
    v_cap := case when r.pillar = 'business' and p_category = 'business' then 3 else 2 end;
    continue when (select count(*) from unnest(v_pillars) x where x = r.pillar) >= v_cap;
    v_codes := v_codes || r.code; v_pillars := v_pillars || r.pillar;
  end loop;

  -- 3. Si besoin, des principes généraux pour arriver à 6.
  for r in select * from public._template_candidates(p_category, p_goal_type, p_weak, p_pushups, v_business, p_school) c
    where c.code <> all(v_codes) and c.score = 0 order by c.sort loop
    exit when cardinality(v_codes) >= 6;
    continue when (select count(*) from unnest(v_pillars) x where x = r.pillar) >= 2;
    v_codes := v_codes || r.code; v_pillars := v_pillars || r.pillar;
  end loop;
  return v_codes;
end;
$$;


create or replace function public._generate_principles(p_enrollment uuid) returns void
language plpgsql set search_path = '' as $$
declare
  e public.enrollments;
  v_code text;
begin
  select * into e from public.enrollments where id = p_enrollment;
  delete from public.principles where enrollment_id = e.id;
  foreach v_code in array public._pick_templates(e.category, e.goal_type, e.weak_points, e.pushups, e.business_types, e.school) loop
    perform public._add_template(e.user_id, v_code);
  end loop;
end;
$$;


-- Métiers et écoles reconnus.
create or replace function public._clean_business(p text[]) returns text[]
language sql immutable set search_path = '' as $$
  select coalesce(array(select distinct b from unnest(coalesce(p, '{}')) b
    where b in ('ecommerce', 'agence', 'saas', 'contenu', 'revente', 'trading', 'immobilier', 'coaching', 'service_local', 'autre')
    limit 10), '{}');
$$;

create or replace function public._clean_school(p text) returns text
language sql immutable set search_path = '' as $$
  select case when p in ('lycee', 'prepa', 'universite', 'commerce', 'ingenieur', 'bts_but', 'autre') then p end;
$$;
drop function if exists public.preview_principles(text, text, text[], text, text, int, text);
create function public.preview_principles(
  p_category text,
  p_goal_type text,
  p_weak_points text[],
  p_wake_time text,
  p_pushups text,
  p_focus_minutes int,
  p_locale text default 'fr',
  p_business_types text[] default '{}',
  p_school text default null
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_wake time := public._hhmm(p_wake_time);
  v_weak text[] := array(select distinct w from unnest(coalesce(p_weak_points, '{}')) w limit 7);
  v_out jsonb := '[]'::jsonb;
  v_code text;
  r jsonb;
begin
  if p_category is null or p_category not in ('etudes', 'business', 'mixte')
    or p_goal_type is null or p_goal_type not in ('revenu', 'clients', 'lancement', 'audience', 'examens', 'corps', 'autre')
    or v_wake is null or v_wake < '04:00' or v_wake > '10:00'
    or p_pushups is null or p_pushups not in ('oui', 'quelques', 'non')
    or p_focus_minutes is null or p_focus_minutes not in (25, 50, 90) then
    raise exception 'Réponses incomplètes.';
  end if;
  foreach v_code in array public._pick_templates(p_category, p_goal_type, v_weak, p_pushups, public._clean_business(p_business_types), public._clean_school(p_school)) loop
    r := public._render_template(v_code, v_wake, p_focus_minutes, p_pushups, p_locale);
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'code', r ->> 'code', 'pillar', r ->> 'pillar',
      'if_text', public._if_text(r ->> 'if_text', p_locale), 'then_text', public._then_text(r ->> 'then_text', p_locale),
      'proof_type', r ->> 'proof_type', 'days', r -> 'days', 'why', r ->> 'why', 'source', r ->> 'source',
      'difficulty', public._difficulty(r ->> 'proof_type', public._clean_target(r ->> 'proof_type', r -> 'target'),
        (r ->> 'difficulty')::int)));
  end loop;
  return jsonb_build_object('principles', v_out, 'templates', (select count(*) from public.principle_templates));
end;
$$;


-- L'arc garde le métier et l'école du joueur.
drop function if exists public.save_arc(text, text, text, numeric, text, boolean, text[], text, text, int, date, uuid, text);
create function public.save_arc(
  p_category text,
  p_goal_type text,
  p_goal_title text,
  p_goal_target numeric,
  p_goal_unit text,
  p_goal_public boolean,
  p_weak_points text[],
  p_wake_time text,
  p_pushups text,
  p_focus_minutes int,
  p_start_date date,
  p_squad_id uuid default null,
  p_locale text default 'fr',
  p_business_types text[] default '{}',
  p_business_other text default null,
  p_school text default null,
  p_school_other text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  v_today date := public.paris_today();
  v_goal text := regexp_replace(btrim(coalesce(p_goal_title, '')), '\s+', ' ', 'g');
  v_unit text := nullif(btrim(coalesce(p_goal_unit, '')), '');
  v_weak text[] := array(select distinct w from unnest(coalesce(p_weak_points, '{}')) w);
  v_wake time := public._hhmm(p_wake_time);
  v_start date := p_start_date;
  s public.squads;
  e public.enrollments;
  v_number int;
begin
  if not exists (select 1 from public.profiles where id = v_user) then
    raise exception 'Crée d''abord ton profil.';
  end if;
  if p_category is null or p_category not in ('etudes', 'business', 'mixte') then
    raise exception 'Choisis ton profil.';
  end if;
  if p_goal_type is null or p_goal_type not in ('revenu', 'clients', 'lancement', 'audience', 'examens', 'corps', 'autre') then
    raise exception 'Choisis le type de ton objectif.';
  end if;
  if length(v_goal) < 3 or length(v_goal) > 120 then
    raise exception 'Ton objectif tient en une phrase, de 3 à 120 caractères.';
  end if;
  if p_goal_target is not null and (p_goal_target <= 0 or p_goal_target >= 1000000000) then
    raise exception 'Chiffre de l''objectif invalide.';
  end if;
  if length(coalesce(v_unit, '')) > 20 then
    raise exception 'Unité trop longue.';
  end if;
  if exists (select 1 from unnest(v_weak) w
    where w not in ('telephone', 'procrastination', 'reveil', 'sport', 'dispersion', 'vente', 'regularite')) then
    raise exception 'Point faible invalide.';
  end if;
  if v_wake is null or v_wake < '04:00' or v_wake > '10:00' then
    raise exception 'Choisis une heure de lever entre 4 h et 10 h.';
  end if;
  if p_pushups is null or p_pushups not in ('oui', 'quelques', 'non') then
    raise exception 'Réponds à la question sur les pompes.';
  end if;
  if p_focus_minutes is null or p_focus_minutes not in (25, 50, 90) then
    raise exception 'Durée de concentration : 25, 50 ou 90 minutes.';
  end if;

  if p_squad_id is not null then
    select * into s from public.squads where id = p_squad_id and is_official and start_date is not null;
    if s.id is null or s.start_date < v_today then
      raise exception 'Ce départ collectif n''est plus ouvert.';
    end if;
    v_start := s.start_date;
  end if;
  if v_start is null or v_start < v_today or v_start > v_today + 120 then
    raise exception 'Choisis un jour 1 entre aujourd''hui et les 4 prochains mois.';
  end if;

  e := public._open_enrollment(v_user);
  if e.id is not null and not (e.status = 'draft' or v_today < e.start_date) then
    raise exception 'Ton arc est en cours : tes principes se modifient dans l''onglet Principes.';
  end if;

  if e.id is null then
    select coalesce(max(arc_number), 0) + 1 into v_number from public.enrollments where user_id = v_user;
    insert into public.enrollments (user_id, arc_number, start_date, category, goal_type, goal_title, goal_target,
      goal_unit, goal_public, weak_points, wake_time, pushups, focus_minutes, utm_source, utm_campaign, locale,
      business_types, business_other, school, school_other)
    select v_user, v_number, v_start, p_category, p_goal_type, v_goal, p_goal_target, v_unit, coalesce(p_goal_public, false),
      v_weak, v_wake, p_pushups, p_focus_minutes, pr.utm_source, pr.utm_campaign, public._locale(p_locale),
      case when p_category <> 'etudes' then public._clean_business(p_business_types) else '{}' end,
      case when p_category <> 'etudes' then nullif(left(btrim(coalesce(p_business_other, '')), 60), '') end,
      case when p_category <> 'business' then public._clean_school(p_school) end,
      case when p_category <> 'business' then nullif(left(btrim(coalesce(p_school_other, '')), 60), '') end
    from public.profiles pr where pr.id = v_user
    returning * into e;
    perform public._generate_principles(e.id);
    -- Arc 90 jours payé d'avance : rattaché à ce nouvel arc.
    update public.profiles set arc_credits = arc_credits - 1 where id = v_user and arc_credits > 0;
    if found then
      update public.enrollments set arc_paid = true, arc_payment = 'credit' where id = e.id;
    end if;
  else
    update public.enrollments
    set category = p_category, goal_type = p_goal_type, goal_title = v_goal, goal_target = p_goal_target,
        goal_unit = v_unit, goal_public = coalesce(p_goal_public, false), weak_points = v_weak, wake_time = v_wake,
        pushups = p_pushups, focus_minutes = p_focus_minutes, start_date = v_start, locale = public._locale(p_locale),
        business_types = case when p_category <> 'etudes' then public._clean_business(p_business_types) else '{}' end,
        business_other = case when p_category <> 'etudes' then nullif(left(btrim(coalesce(p_business_other, '')), 60), '') end,
        school = case when p_category <> 'business' then public._clean_school(p_school) end,
        school_other = case when p_category <> 'business' then nullif(left(btrim(coalesce(p_school_other, '')), 60), '') end
    where id = e.id;
    update public.principles set active_from = v_start where enrollment_id = e.id;
  end if;

  if s.id is not null then
    insert into public.squad_members (squad_id, user_id) values (s.id, v_user) on conflict do nothing;
  end if;
  perform public._activate_enrollment(e.id);
  return e.id;
end;
$$;


create or replace function public._plan_json(p_user uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'plan', public._plan(p_user),
    'paid_plan', pr.plan, 'interval', pr.plan_interval, 'status', pr.plan_status,
    'period_end', pr.current_period_end, 'cancel_at_period_end', pr.cancel_at_period_end,
    'comp_until', case when pr.comp_until >= public.paris_today() then pr.comp_until end,
    'arc_paid', exists (select 1 from public.enrollments e where e.user_id = p_user and e.status in ('draft', 'active') and e.arc_paid),
    'arc_credits', pr.arc_credits,
    'loyalty_pending', pr.loyalty_pending,
    'referral_rewards', pr.referral_rewards,
    'limits', public._limits(public._plan(p_user))
      || jsonb_build_object('wallet', public._can_wallet(p_user), 'grades', public._can_grades(p_user))
  )
  from public.profiles pr where pr.id = p_user;
$$;


create or replace function public.add_wallet_entry(
  p_user uuid,
  p_amount_cents int,
  p_source text,
  p_label text,
  p_day date,
  p_proof_path text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_today date := public.paris_today();
  v_label text := regexp_replace(btrim(coalesce(p_label, '')), '\s+', ' ', 'g');
  v_day date := coalesce(p_day, v_today);
  e public.enrollments := public._open_enrollment(p_user);
  v_status text;
  v_id uuid;
  v_points int := 0;
  v_audit boolean := false;
begin
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'Profil introuvable.';
  end if;
  if not public._can_wallet(p_user) then
    raise exception 'Le portefeuille est inclus dans les arcs business et le plan Pro.';
  end if;
  if p_amount_cents is null or p_amount_cents < 1 or p_amount_cents > 100000000 then
    raise exception 'Montant invalide (de 0,01 € à 1 000 000 €).';
  end if;
  if p_source is null or p_source not in ('vente', 'client', 'freelance', 'contenu', 'autre') then
    raise exception 'Choisis la source.';
  end if;
  if length(v_label) < 2 or length(v_label) > 80 then
    raise exception 'Libellé : de 2 à 80 caractères.';
  end if;
  if v_day > v_today or v_day < v_today - 30 then
    raise exception 'Date : dans les 30 derniers jours.';
  end if;
  if p_proof_path is not null then
    perform public._check_proof_file(p_user, p_proof_path);
  end if;
  if e.id is not null and not (e.status = 'active' and v_day between e.start_date and e.end_date) then
    e := null;
  end if;

  v_status := case when p_proof_path is null then 'declared' else 'proven' end;
  insert into public.wallet_entries (user_id, enrollment_id, day, amount_cents, source, label, proof_path, status)
  values (p_user, e.id, v_day, p_amount_cents, p_source, v_label, p_proof_path, v_status)
  returning id into v_id;

  -- Revenu prouvé pendant l'arc : + 15, une fois par jour.
  if v_status = 'proven' and e.id is not null then
    if public._award(e.id, p_user, v_today, 15, 'wallet', public._ref('wallet:' || p_user || ':' || v_today)) then
      v_points := 15;
    end if;
    if random() < public._audit_rate() then
      insert into public.audits (wallet_entry_id, enrollment_id, user_id, due_at, penalty)
      values (v_id, e.id, p_user, now() + interval '24 hours', 30);
      update public.wallet_entries set status = 'audit_pending' where id = v_id;
      v_audit := true;
    end if;
  end if;

  perform public._after_change(p_user);
  return jsonb_build_object('id', v_id, 'status', case when v_audit then 'audit_pending' else v_status end,
    'points', v_points, 'audit', v_audit);
end;
$$;


create or replace function public.my_wallet() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  v_today date := public.paris_today();
  e public.enrollments := public._current_enrollment(v_user);
begin
  return jsonb_build_object(
    'enabled', public._can_wallet(v_user),
    'proven_cents', (select coalesce(sum(amount_cents), 0) from public.wallet_entries
      where user_id = v_user and status in ('proven', 'audit_pending')),
    'declared_cents', (select coalesce(sum(amount_cents), 0) from public.wallet_entries
      where user_id = v_user and status = 'declared'),
    'month_cents', (select coalesce(sum(amount_cents), 0) from public.wallet_entries
      where user_id = v_user and status <> 'rejected' and day >= date_trunc('month', v_today)::date),
    'arc_cents', case when e.id is null then 0 else (select coalesce(sum(amount_cents), 0) from public.wallet_entries
      where user_id = v_user and status <> 'rejected' and day between e.start_date and e.end_date) end,
    'xp_today', exists (select 1 from public.points_ledger where user_id = v_user and reason = 'wallet' and day = v_today),
    'goal', case when e.id is not null and e.goal_type = 'revenu' then jsonb_build_object(
      'title', e.goal_title, 'target', e.goal_target, 'unit', e.goal_unit) end,
    'months', (
      select coalesce(jsonb_agg(jsonb_build_object('month', to_char(m, 'YYYY-MM'),
        'proven_cents', (select coalesce(sum(amount_cents), 0) from public.wallet_entries w
          where w.user_id = v_user and w.status in ('proven', 'audit_pending') and date_trunc('month', w.day) = m),
        'declared_cents', (select coalesce(sum(amount_cents), 0) from public.wallet_entries w
          where w.user_id = v_user and w.status = 'declared' and date_trunc('month', w.day) = m)
      ) order by m), '[]'::jsonb)
      from generate_series(date_trunc('month', v_today) - interval '5 months', date_trunc('month', v_today), interval '1 month') m
    ),
    'entries', (
      select coalesce(jsonb_agg(jsonb_build_object('id', w.id, 'day', w.day, 'amount_cents', w.amount_cents,
        'source', w.source, 'label', w.label, 'status', w.status, 'has_proof', w.proof_path is not null)
        order by w.day desc, w.created_at desc), '[]'::jsonb)
      from (select * from public.wallet_entries where user_id = v_user order by day desc, created_at desc limit 100) w
    )
  );
end;
$$;


-- Bibliothèque : « Pour toi » tient compte du métier et de l'école.
create or replace function public.my_principles() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  e public.enrollments := public._open_enrollment(v_user);
  v_eff date;
  v_plan text := public._plan(v_user);
begin
  if e.id is null then
    e := public._current_enrollment(v_user);
  end if;
  if e.id is null then
    return jsonb_build_object('enrollment', null);
  end if;
  v_eff := case when e.status in ('draft', 'active') then public._effective_day(e) else e.end_date end;
  return jsonb_build_object(
    'enrollment', jsonb_build_object('id', e.id, 'status', e.status, 'start_date', e.start_date, 'end_date', e.end_date,
      'goal_type', e.goal_type, 'goal_title', e.goal_title, 'category', e.category),
    'editable', e.status in ('draft', 'active') and v_eff <= e.end_date,
    'started', e.status = 'active' and public.paris_today() >= e.start_date,
    'effective_day', v_eff,
    'plan', v_plan,
    'limits', public._limits(v_plan),
    'principles', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'position', p.position, 'pillar', p.pillar, 'if_text', p.if_text, 'then_text', p.then_text,
        'proof_type', p.proof_type, 'difficulty', p.difficulty, 'value', 10 * p.difficulty, 'days', p.days,
        'target', p.target, 'why', p.why, 'source', p.source, 'template_code', p.template_code,
        'pending', p.active_from > public.paris_today() and e.status = 'active' and public.paris_today() >= e.start_date
      ) order by p.position), '[]'::jsonb)
      from public.principles p
      where p.enrollment_id = e.id and p.active_from <= v_eff and (p.active_until is null or p.active_until >= v_eff)
    ),
    'templates', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'code', t.code, 'pillar', t.pillar,
        'if_text', coalesce(t.i18n -> e.locale ->> 'if_text', t.if_text),
        'then_text', coalesce(t.i18n -> e.locale ->> 'then_text', t.then_text), 'proof_type', t.proof_type,
        'difficulty', t.difficulty, 'days', t.days, 'target', t.target,
        'why', coalesce(t.i18n -> e.locale ->> 'why', t.why), 'source', coalesce(t.i18n -> e.locale ->> 'source', t.source),
        'recommended', (e.category = any(t.categories) and not (t.not_for && e.business_types)) and (
          t.business_types && e.business_types or (e.school is not null and e.school = any(t.schools))
          or e.goal_type = any(t.goal_types)
          or exists (select 1 from unnest(t.weak_points) w where w = any(e.weak_points)))
      ) order by t.pillar, t.sort), '[]'::jsonb)
      from public.principle_templates t
    )
  );
end;
$$;


-- Les notes prouvées comptent pour la stat Esprit.
create or replace function public._refresh_stats(p_user uuid) returns void
language plpgsql set search_path = '' as $$
declare
  v_today date := public.paris_today();
  v_from date := public.paris_today() - 29;
  e public.enrollments := public._current_enrollment(p_user);
  v_xp int;
  v_focus int;
  v_corps int;
  v_business int;
  v_esprit int;
  v_energie int;
  v_wallet_xp int;
  v_grade_xp int;
  v_closed int;
  v_good int;
  v_disc int;
  v_streak int := 0;
  v_best int;
  d record;
begin
  select coalesce(sum(delta) filter (where delta > 0), 0) into v_xp from public.points_ledger where user_id = p_user;

  select
    coalesce(sum(v.points) filter (where v.pillar = 'focus'), 0),
    coalesce(sum(v.points) filter (where v.pillar = 'corps'), 0),
    coalesce(sum(v.points) filter (where v.pillar = 'business'), 0),
    coalesce(sum(v.points) filter (where v.pillar = 'esprit'), 0),
    coalesce(sum(v.points) filter (where v.pillar = 'energie'), 0)
  into v_focus, v_corps, v_business, v_esprit, v_energie
  from public.validations v join public.enrollments en on en.id = v.enrollment_id
  where en.user_id = p_user and v.day between v_from and v_today and v.status <> 'rejected';

  select coalesce(sum(delta), 0) into v_wallet_xp from public.points_ledger
  where user_id = p_user and reason = 'wallet' and day between v_from and v_today;
  v_business := v_business + v_wallet_xp;
  select coalesce(sum(delta), 0) into v_grade_xp from public.points_ledger
  where user_id = p_user and reason = 'grade' and day between v_from and v_today;
  v_esprit := v_esprit + v_grade_xp;

  select count(*), count(*) filter (where ds.status in ('green', 'joker'))
  into v_closed, v_good
  from public.day_status ds join public.enrollments en on en.id = ds.enrollment_id
  where en.user_id = p_user and ds.day between v_from and v_today;
  v_disc := case when v_closed = 0 then 0 else round(99.0 * v_good / v_closed)::int end;

  -- Série : jours verts d'affilée jusqu'au dernier jour clos (un joker ne la casse pas).
  if e.id is not null then
    for d in select status from public.day_status where enrollment_id = e.id order by day desc loop
      if d.status = 'green' then
        v_streak := v_streak + 1;
      elsif d.status = 'joker' then
        continue;
      else
        exit;
      end if;
    end loop;
  end if;
  select greatest(coalesce(max(best_streak), 0), v_streak) into v_best from public.player_stats where user_id = p_user;

  insert into public.player_stats as ps (user_id, xp, level, level_seen, ovr, discipline, focus, corps, business, esprit,
    energie, streak, best_streak, green_days, focus_minutes, reps, wakes, wallet_proven_cents, wallet_declared_cents,
    arcs_completed, updated_at)
  select p_user, v_xp, public._level_for(v_xp), public._level_for(v_xp),
    round((v_disc + least(99, round(99.0 * v_focus / 600)) + least(99, round(99.0 * v_corps / 600))
      + least(99, round(99.0 * v_business / 600)) + least(99, round(99.0 * v_esprit / 600))
      + least(99, round(99.0 * v_energie / 600))) / 6.0)::int,
    v_disc,
    least(99, round(99.0 * v_focus / 600))::int,
    least(99, round(99.0 * v_corps / 600))::int,
    least(99, round(99.0 * v_business / 600))::int,
    least(99, round(99.0 * v_esprit / 600))::int,
    least(99, round(99.0 * v_energie / 600))::int,
    v_streak, v_best,
    (select count(*) from public.day_status ds join public.enrollments en on en.id = ds.enrollment_id
      where en.user_id = p_user and ds.status = 'green')::int,
    (select coalesce(sum(minutes), 0) from public.proof_sessions where user_id = p_user and kind = 'session' and status = 'completed')::int,
    (select coalesce(sum((data ->> 'count')::int), 0) from public.proof_sessions where user_id = p_user and kind = 'reps' and status = 'completed')::int,
    (select count(*) from public.proof_sessions where user_id = p_user and kind = 'reveil' and status = 'completed')::int,
    (select coalesce(sum(amount_cents), 0) from public.wallet_entries where user_id = p_user and status in ('proven', 'audit_pending')),
    (select coalesce(sum(amount_cents), 0) from public.wallet_entries where user_id = p_user and status = 'declared'),
    (select count(*) from public.enrollments where user_id = p_user and status = 'completed')::int,
    now()
  on conflict (user_id) do update set
    xp = excluded.xp, level = excluded.level, ovr = excluded.ovr, discipline = excluded.discipline,
    focus = excluded.focus, corps = excluded.corps, business = excluded.business, esprit = excluded.esprit,
    energie = excluded.energie, streak = excluded.streak, best_streak = excluded.best_streak,
    green_days = excluded.green_days, focus_minutes = excluded.focus_minutes, reps = excluded.reps,
    wakes = excluded.wakes, wallet_proven_cents = excluded.wallet_proven_cents,
    wallet_declared_cents = excluded.wallet_declared_cents, arcs_completed = excluded.arcs_completed,
    updated_at = excluded.updated_at;
end;
$$;


create or replace function public.cron_photo_cleanup_targets() returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(o.name), '{}')
  from storage.objects o
  where o.bucket_id = 'proofs'
    and not exists (select 1 from public.enrollments e where e.before_photo_path = o.name or e.after_photo_path = o.name)
    and (o.created_at < now() - interval '30 days'
      or (o.created_at < now() - interval '1 day'
        and not exists (select 1 from public.validations v where v.photo_path = o.name)
        and not exists (select 1 from public.audits a where a.photo_path = o.name)
        and not exists (select 1 from public.challenge_proofs cp where cp.photo_path = o.name)
        and not exists (select 1 from public.wallet_entries w where w.proof_path = o.name)
        and not exists (select 1 from public.grades g where g.proof_path = o.name)));
$$;


create or replace function public.mark_photos_deleted(p_paths text[]) returns void
language sql security definer set search_path = '' as $$
  update public.validations set photo_deleted_at = now() where photo_path = any(p_paths) and photo_deleted_at is null;
  update public.audits set photo_deleted_at = now() where photo_path = any(p_paths) and photo_deleted_at is null;
  update public.challenge_proofs set photo_deleted_at = now() where photo_path = any(p_paths) and photo_deleted_at is null;
  update public.wallet_entries set proof_deleted_at = now() where proof_path = any(p_paths) and proof_deleted_at is null;
  update public.grades set proof_deleted_at = now() where proof_path = any(p_paths) and proof_deleted_at is null;
$$;


-- Carnet de notes : ajout (serveur, après vérification de la capture), suppression, lecture.
create or replace function public.add_grade(
  p_user uuid, p_subject text, p_score numeric, p_out_of numeric, p_coefficient numeric, p_day date, p_proof_path text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_today date := public.paris_today();
  v_subject text := regexp_replace(btrim(coalesce(p_subject, '')), '\s+', ' ', 'g');
  v_day date := coalesce(p_day, v_today);
  e public.enrollments := public._open_enrollment(p_user);
  v_status text := case when p_proof_path is null then 'declared' else 'proven' end;
  v_id uuid;
  v_points int := 0;
begin
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'Profil introuvable.';
  end if;
  if not public._can_grades(p_user) then
    raise exception 'Le carnet de notes est inclus dans les arcs études.';
  end if;
  if length(v_subject) < 2 or length(v_subject) > 60 then
    raise exception 'Matière : de 2 à 60 caractères.';
  end if;
  if p_out_of is null or p_out_of <= 0 or p_out_of > 1000 or p_score is null or p_score < 0 or p_score > p_out_of then
    raise exception 'Note invalide.';
  end if;
  if p_coefficient is not null and (p_coefficient <= 0 or p_coefficient > 100) then
    raise exception 'Coefficient invalide.';
  end if;
  if v_day > v_today or v_day < v_today - 60 then
    raise exception 'Date : dans les 60 derniers jours.';
  end if;
  if p_proof_path is not null then
    perform public._check_proof_file(p_user, p_proof_path);
  end if;
  if e.id is not null and not (e.status = 'active' and v_day between e.start_date and e.end_date) then
    e := null;
  end if;
  insert into public.grades (user_id, enrollment_id, day, subject, score, out_of, coefficient, proof_path, status)
  values (p_user, e.id, v_day, v_subject, p_score, p_out_of, coalesce(p_coefficient, 1), p_proof_path, v_status)
  returning id into v_id;
  -- Note prouvée pendant l'arc : + 10, une fois par jour.
  if v_status = 'proven' and e.id is not null then
    if public._award(e.id, p_user, v_today, 10, 'grade', public._ref('grade:' || p_user || ':' || v_today)) then
      v_points := 10;
    end if;
  end if;
  perform public._after_change(p_user);
  return jsonb_build_object('id', v_id, 'status', v_status, 'points', v_points);
end;
$$;

create or replace function public.delete_grade(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
begin
  delete from public.grades where id = p_id and user_id = v_user and status = 'declared';
  if not found then
    raise exception 'Seule une note non prouvée peut être retirée.';
  end if;
end;
$$;

create or replace function public.my_grades() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  v_today date := public.paris_today();
begin
  return jsonb_build_object(
    'enabled', public._can_grades(v_user),
    'xp_today', exists (select 1 from public.points_ledger where user_id = v_user and reason = 'grade' and day = v_today),
    -- Moyennes ramenées sur 20, pondérées par les coefficients.
    'average', (select round(sum(score / out_of * 20 * coefficient) / nullif(sum(coefficient), 0), 2)
      from public.grades where user_id = v_user),
    'count', (select count(*) from public.grades where user_id = v_user),
    'subjects', (
      select coalesce(jsonb_agg(jsonb_build_object('subject', s.subject, 'average', s.average, 'count', s.n)
        order by s.subject), '[]'::jsonb)
      from (
        select subject, count(*)::int as n, round(sum(score / out_of * 20 * coefficient) / sum(coefficient), 2) as average
        from public.grades where user_id = v_user group by subject
      ) s
    ),
    'weeks', (
      select coalesce(jsonb_agg(jsonb_build_object('week', w.week, 'average', w.average) order by w.week), '[]'::jsonb)
      from (
        select to_char(date_trunc('week', day), 'YYYY-MM-DD') as week,
          round(sum(score / out_of * 20 * coefficient) / sum(coefficient), 2) as average
        from public.grades where user_id = v_user and day > v_today - 120
        group by 1
      ) w
    ),
    'entries', (
      select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'day', g.day, 'subject', g.subject, 'score', g.score,
        'out_of', g.out_of, 'coefficient', g.coefficient, 'status', g.status, 'has_proof', g.proof_path is not null)
        order by g.day desc, g.created_at desc), '[]'::jsonb)
      from (select * from public.grades where user_id = v_user order by day desc, created_at desc limit 100) g
    )
  );
end;
$$;

-- Droits d'exécution.
revoke execute on function public._template_candidates(text, text, text[], text, text[], text) from public, anon, authenticated;
revoke execute on function public._can_wallet(uuid), public._can_grades(uuid), public._clean_business(text[]),
  public._clean_school(text), public._pick_templates(text, text, text[], text, text[], text)
  from public, anon, authenticated;
revoke execute on function public.add_grade(uuid, text, numeric, numeric, numeric, date, text) from public, anon, authenticated;
grant execute on function public.add_grade(uuid, text, numeric, numeric, numeric, date, text) to service_role;
revoke execute on function public.delete_grade(uuid), public.my_grades() from public, anon;
grant execute on function public.delete_grade(uuid) to authenticated;
grant execute on function public.my_grades() to authenticated;
revoke execute on function public.save_arc(text, text, text, numeric, text, boolean, text[], text, text, int, date, uuid, text,
  text[], text, text, text) from public, anon;
grant execute on function public.save_arc(text, text, text, numeric, text, boolean, text[], text, text, int, date, uuid, text,
  text[], text, text, text) to authenticated;
revoke execute on function public.preview_principles(text, text, text[], text, text, int, text, text[], text) from public;
grant execute on function public.preview_principles(text, text, text[], text, text, int, text, text[], text) to anon, authenticated, service_role;
