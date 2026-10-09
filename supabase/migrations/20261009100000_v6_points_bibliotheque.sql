-- V6 (9 octobre 2026) : les notes et les revenus rapportent des points selon leur valeur (la moitié sans preuve),
-- remboursés si on les retire ; la bibliothèque de principes est triée par pertinence pour le joueur.

-- Gains du jour pour une raison (les remboursements ne rendent pas de place : pas d'aller-retour pour farmer).
create or replace function public._day_gains(p_user uuid, p_reason text, p_day date) returns int
language sql stable set search_path = '' as $$
  select coalesce(sum(delta) filter (where delta > 0), 0)::int from public.points_ledger
  where user_id = p_user and reason = p_reason and day = p_day;
$$;

-- Note ramenée sur 20 : 10 → +5, 12 → +10, 14 → +15, 16 et plus → +20 ; la moitié sans capture.
create or replace function public._grade_points(p_score numeric, p_out_of numeric, p_proven boolean) returns int
language sql immutable set search_path = '' as $$
  select (case
    when p_score / p_out_of * 20 >= 16 then 20
    when p_score / p_out_of * 20 >= 14 then 15
    when p_score / p_out_of * 20 >= 12 then 10
    when p_score / p_out_of * 20 >= 10 then 5
    else 0 end) / (case when p_proven then 1 else 2 end);
$$;

-- Revenu : 10 points, plus 1 par tranche de 10 €, 50 au plus ; la moitié sans capture.
create or replace function public._wallet_points(p_amount_cents int, p_proven boolean) returns int
language sql immutable set search_path = '' as $$
  select least(50, 10 + p_amount_cents / 1000) / (case when p_proven then 1 else 2 end);
$$;

-- Pertinence d'un gabarit pour un arc : même calcul que le choix des 6 principes (_template_candidates).
create or replace function public._template_score(t public.principle_templates, e public.enrollments) returns int
language sql stable set search_path = '' as $$
  select case when not (e.category = any(t.categories))
      or (cardinality(coalesce(e.business_types, '{}')) > 0 and coalesce(e.business_types, '{}') <@ t.not_for) then -100
    else ((case when t.business_types && coalesce(e.business_types, '{}')
        then 8 + (case when cardinality(t.business_types) <= 2 then 4 else 0 end) else 0 end)
      + (case when e.school is not null and e.school = any(t.schools)
        then 8 + (case when cardinality(t.schools) <= 2 then 4 else 0 end) else 0 end)
      + (case when e.goal_type = any(t.goal_types) then 5 else 0 end)
      + 3 * (select count(*) from unnest(t.weak_points) w where w = any(coalesce(e.weak_points, '{}')))
      - (case when cardinality(t.business_types) > 0 and cardinality(coalesce(e.business_types, '{}')) > 0
          and not (t.business_types && coalesce(e.business_types, '{}')) then 4 else 0 end)
      - (case when cardinality(t.schools) > 0 and e.school is not null and not (e.school = any(t.schools)) then 4 else 0 end))::int
  end;
$$;

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
  -- Pendant l'arc : points selon la note, 30 au plus par jour.
  if e.id is not null then
    v_points := least(public._grade_points(p_score, p_out_of, v_status = 'proven'),
      greatest(0, 30 - public._day_gains(p_user, 'grade', v_today)));
    if v_points > 0 and not public._award(e.id, p_user, v_today, v_points, 'grade', public._ref('grade:' || v_id)) then
      v_points := 0;
    end if;
  end if;
  perform public._after_change(p_user);
  return jsonb_build_object('id', v_id, 'status', v_status, 'points', v_points);
end;
$$;

-- Une note non prouvée retirée : ses points aussi.
create or replace function public.delete_grade(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  l public.points_ledger;
begin
  delete from public.grades where id = p_id and user_id = v_user and status = 'declared';
  if not found then
    raise exception 'Seule une note non prouvée peut être retirée.';
  end if;
  select * into l from public.points_ledger where reason = 'grade' and ref_id = public._ref('grade:' || p_id);
  if l.id is not null and l.delta > 0 then
    perform public._award(l.enrollment_id, v_user, public.paris_today(), -l.delta, 'grade', public._ref('grade-retiree:' || p_id));
  end if;
  perform public._after_change(v_user);
end;
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

  -- Pendant l'arc : points selon le montant, 50 au plus par jour. Un revenu prouvé peut être contrôlé.
  if e.id is not null then
    v_points := least(public._wallet_points(p_amount_cents, v_status = 'proven'),
      greatest(0, 50 - public._day_gains(p_user, 'wallet', v_today)));
    if v_points > 0 and not public._award(e.id, p_user, v_today, v_points, 'wallet', public._ref('wallet:' || v_id)) then
      v_points := 0;
    end if;
    if v_status = 'proven' and random() < public._audit_rate() then
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

-- Un revenu non prouvé retiré : ses points aussi.
create or replace function public.delete_wallet_entry(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  l public.points_ledger;
begin
  delete from public.wallet_entries where id = p_id and user_id = v_user and status = 'declared';
  if not found then
    raise exception 'Seul un revenu non prouvé peut être retiré.';
  end if;
  select * into l from public.points_ledger where reason = 'wallet' and ref_id = public._ref('wallet:' || p_id);
  if l.id is not null and l.delta > 0 then
    perform public._award(l.enrollment_id, v_user, public.paris_today(), -l.delta, 'wallet', public._ref('wallet-retire:' || p_id));
  end if;
  perform public._after_change(v_user);
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
    'points_today', public._day_gains(v_user, 'grade', v_today),
    'points_cap', 30,
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
    'points_today', public._day_gains(v_user, 'wallet', v_today),
    'points_cap', 50,
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
        'score', public._template_score(t, e),
        'for_business', t.business_types && e.business_types,
        'for_school', e.school is not null and e.school = any(t.schools),
        'added', exists (select 1 from public.principles p where p.enrollment_id = e.id and p.template_code = t.code
          and p.active_from <= v_eff and (p.active_until is null or p.active_until >= v_eff)),
        'recommended', public._template_score(t, e) >= 5
      ) order by public._template_score(t, e) desc, t.sort), '[]'::jsonb)
      from public.principle_templates t
    )
  );
end;
$$;

revoke execute on function public._day_gains(uuid, text, date), public._grade_points(numeric, numeric, boolean),
  public._wallet_points(int, boolean), public._template_score(public.principle_templates, public.enrollments)
  from public, anon, authenticated;
