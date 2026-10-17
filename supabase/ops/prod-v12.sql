-- Production : v12 (historique de l'arc), à coller dans l'éditeur SQL de Supabase.
begin;
-- V12 (17 octobre 2026) : l'historique complet de l'arc, jour par jour (anneaux du calendrier d'historique).
-- Même calcul que my_week, du jour 1 de l'arc à aujourd'hui (ou au jour 90).
create or replace function public.my_history() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  e public.enrollments := public._current_enrollment(v_user);
  v_today date := public.paris_today();
begin
  if e.id is null or v_today < e.start_date then
    return jsonb_build_object('start', e.start_date, 'end', e.end_date, 'days', '[]'::jsonb);
  end if;
  return jsonb_build_object(
    'start', e.start_date,
    'end', e.end_date,
    'days', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', d::date,
        'in_arc', true,
        'status', (select ds.status from public.day_status ds where ds.enrollment_id = e.id and ds.day = d::date),
        'joker', exists (select 1 from public.joker_days j where j.enrollment_id = e.id and j.day = d::date),
        'due', (select count(*) from public.principles p
          where p.enrollment_id = e.id and public._on_day(p.active_from, p.active_until, p.days, d::date))::int,
        'done', (select count(*) from public.validations v
          where v.enrollment_id = e.id and v.day = d::date and v.status in ('valid', 'audit_pending'))::int
      ) order by d), '[]'::jsonb)
      from generate_series(e.start_date::timestamp, least(v_today, e.end_date)::timestamp, interval '1 day') d
    )
  );
end;
$$;

revoke execute on function public.my_history() from public, anon;
grant execute on function public.my_history() to authenticated;

commit;
