-- V8 (9 octobre 2026) : changer de langue traduit aussi l'arc ouvert.
-- Avant, l'arc gardait la langue du questionnaire : principes et bibliothèque restaient en français.
-- Les principes venus de la bibliothèque, encore tels quels, sont réécrits dans la nouvelle langue ;
-- ceux que le joueur a écrits ou retouchés restent mot pour mot (on ne traduit pas ses phrases).

create or replace function public._translate_arc(p_enrollment uuid, p_locale text) returns void
language plpgsql set search_path = '' as $$
declare
  e public.enrollments;
  l text := public._locale(p_locale);
  p public.principles;
  r_old jsonb;
  r_new jsonb;
begin
  select * into e from public.enrollments where id = p_enrollment and status in ('draft', 'active');
  if e.id is null or e.locale = l then
    return;
  end if;
  for p in
    select * from public.principles
    where enrollment_id = e.id and template_code is not null
      and (active_until is null or active_until >= public.paris_today())
  loop
    r_old := public._render_template(p.template_code, e.wake_time, e.focus_minutes, e.pushups, e.locale);
    r_new := public._render_template(p.template_code, e.wake_time, e.focus_minutes, e.pushups, l);
    if r_old is null or r_new is null then
      continue;
    end if;
    if p.if_text = public._if_text(r_old ->> 'if_text', e.locale) and p.then_text = public._then_text(r_old ->> 'then_text', e.locale) then
      update public.principles
      set if_text = public._if_text(r_new ->> 'if_text', l),
          then_text = public._then_text(r_new ->> 'then_text', l),
          why = coalesce(r_new ->> 'why', why),
          target = case when target ? 'unit' and r_new -> 'target' ? 'unit' then jsonb_set(target, '{unit}', r_new -> 'target' -> 'unit') else target end
      where id = p.id;
    end if;
  end loop;
  update public.enrollments set locale = l where id = e.id;
end;
$$;

create or replace function public.set_my_locale(p_locale text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  e public.enrollments := public._open_enrollment(v_user);
begin
  update public.profiles set locale = public._locale(p_locale) where id = v_user;
  if e.id is not null then
    perform public._translate_arc(e.id, p_locale);
  end if;
end;
$$;

revoke execute on function public._translate_arc(uuid, text) from public, anon, authenticated;
grant execute on function public.set_my_locale(text) to authenticated;

-- Rattrapage : les arcs ouverts passent dans la langue actuelle de leur joueur.
do $$
declare
  r record;
begin
  for r in
    select e.id, pr.locale from public.enrollments e join public.profiles pr on pr.id = e.user_id
    where e.status in ('draft', 'active') and e.locale <> pr.locale
  loop
    perform public._translate_arc(r.id, r.locale);
  end loop;
end;
$$;
