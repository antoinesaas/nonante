-- Production : v19 (essai gratuit de 7 jours), à coller dans l'éditeur SQL de Supabase.
begin;
-- V19 (23 octobre 2026) : essai gratuit de 7 jours, sans carte bancaire, une fois par compte.
-- Pendant l'essai, le joueur a les droits de l'Arc 90 jours (6 principes, 1 joker, toutes les preuves) : son arc se
-- lance tout de suite. À la fin, sans plan payé, plus rien ne se valide (comme un abonnement inactif) jusqu'au paiement.
-- Tous les comptes déjà inscrits sans plan reçoivent aussi leurs 7 jours, à partir d'aujourd'hui.

alter table public.profiles add column if not exists trial_started date;
alter table public.profiles add column if not exists trial_until date;

-- Plan effectif : payé, puis offert (Pro), puis Arc 90 jours payé, puis offert, puis essai (droits de l'Arc 90 jours).
create or replace function public._plan(p_user uuid) returns text
language sql stable set search_path = '' as $$
  with p as (select * from public.profiles where id = p_user),
  paid as (
    select case
      when p.plan = 'fondateur' and p.plan_status = 'lifetime' then 'fondateur'
      when p.plan = 'pro' and p.plan_status in ('active', 'trialing', 'past_due') then 'pro'
    end as plan
    from p
  ),
  comp as (
    select case when p.comp_until is not null and p.comp_until >= public.paris_today() then p.comp_plan end as plan from p
  ),
  pass as (
    select 'arc'::text as plan from public.enrollments e
    where e.user_id = p_user and e.status in ('draft', 'active') and e.arc_paid
    limit 1
  ),
  trial as (
    select case when p.trial_until is not null and p.trial_until >= public.paris_today() then 'arc' end as plan from p
  )
  select coalesce(
    (select plan from paid),
    case when (select plan from comp) = 'pro' then 'pro' end,
    (select plan from pass),
    (select plan from comp),
    (select plan from trial)
  );
$$;

-- Essai en cours ? (pour l'affichage : un plan payé ou offert passe devant)
create or replace function public._on_trial(p_user uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = p_user and p.trial_until >= public.paris_today())
    and coalesce((select pr.plan = 'fondateur' or (pr.plan = 'pro' and pr.plan_status in ('active', 'trialing', 'past_due'))
                  from public.profiles pr where pr.id = p_user), false) is false
    and not exists (select 1 from public.enrollments e where e.user_id = p_user and e.status in ('draft', 'active') and e.arc_paid)
    and not exists (select 1 from public.profiles pr where pr.id = p_user and pr.comp_until >= public.paris_today());
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
    'trial', public._on_trial(p_user),
    'trial_until', pr.trial_until,
    'trial_available', pr.trial_started is null,
    'limits', public._limits(public._plan(p_user))
      || jsonb_build_object('wallet', public._can_wallet(p_user), 'grades', public._can_grades(p_user))
  )
  from public.profiles pr where pr.id = p_user;
$$;

-- Lance l'essai (une fois par compte) et l'arc en construction.
create or replace function public.start_trial() returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  pr public.profiles;
  e public.enrollments;
begin
  select * into pr from public.profiles where id = v_user for update;
  if pr.id is null then
    raise exception 'Commence par créer ton profil.';
  end if;
  if pr.trial_started is not null and (pr.trial_until is null or pr.trial_until < public.paris_today()) then
    raise exception 'Ton essai gratuit est déjà utilisé : choisis un plan pour continuer.';
  end if;
  if pr.trial_started is null then
    update public.profiles set trial_started = public.paris_today(), trial_until = public.paris_today() + 6 where id = v_user;
  end if;
  e := public._open_enrollment(v_user);
  if e.id is not null and e.status = 'draft' then
    perform public._activate_enrollment(e.id);
  end if;
  return true;
end;
$$;
revoke execute on function public._on_trial(uuid) from public, anon, authenticated;
revoke execute on function public.start_trial() from public, anon;
grant execute on function public.start_trial() to authenticated;

-- Comptes déjà inscrits sans plan : leurs 7 jours commencent aujourd'hui (l'arc en construction se lance à la
-- prochaine ouverture de l'app).
update public.profiles p
   set trial_started = public.paris_today(), trial_until = public.paris_today() + 6
 where p.trial_started is null and public._plan(p.id) is null;

commit;
