-- V13 (18 octobre 2026) : le minuteur se règle à la minute près, de 10 à 180 minutes par pas de 5
-- (sélecteur à faire glisser), au lieu de 25, 50 ou 90. Difficulté inchangée : ≤ 25 → 1, ≤ 50 → 2, au-delà → 3.

create or replace function public._valid_minutes(p_minutes int) returns boolean
language sql immutable set search_path = '' as $$
  select p_minutes between 10 and 180 and p_minutes % 5 = 0
$$;
revoke execute on function public._valid_minutes(int) from public, anon, authenticated;

alter table public.proof_sessions drop constraint if exists proof_sessions_minutes_check;
alter table public.proof_sessions add constraint proof_sessions_minutes_check check (minutes is null or public._valid_minutes(minutes));

create or replace function public._clean_target(p_proof text, p_target jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  v jsonb := coalesce(p_target, '{}'::jsonb);
  v_out jsonb := '{}'::jsonb;
  v_n int;
  v_t time;
  v_unit text;
  v_domains text[];
begin
  if jsonb_typeof(v) <> 'object' then
    raise exception 'Cible invalide.';
  end if;
  case p_proof
    when 'session' then
      v_n := case when v ->> 'minutes' ~ '^\d{1,3}$' then (v ->> 'minutes')::int end;
      if v_n is null or not public._valid_minutes(v_n) then
        raise exception 'Durée de session : de 10 à 180 minutes.';
      end if;
      v_out := jsonb_build_object('minutes', v_n);
      if v ? 'before' and v ->> 'before' is not null then
        v_t := public._hhmm(v ->> 'before');
        if v_t is null or v_t < '06:00' then
          raise exception 'Heure limite invalide.';
        end if;
        v_out := v_out || jsonb_build_object('before', to_char(v_t, 'HH24:MI'));
      end if;
    when 'reps' then
      v_n := case when v ->> 'reps' ~ '^\d{1,3}$' then (v ->> 'reps')::int end;
      if coalesce(v ->> 'exercise', '') not in ('pushup', 'squat') then
        raise exception 'Exercice : pompes ou squats.';
      end if;
      if v_n is null or v_n < 5 or v_n > 300 then
        raise exception 'Nombre de répétitions : de 5 à 300.';
      end if;
      v_out := jsonb_build_object('exercise', v ->> 'exercise', 'reps', v_n);
    when 'reveil' then
      v_t := public._hhmm(v ->> 'before');
      if v_t is null or v_t < '04:00' or v_t > '10:00' then
        raise exception 'Heure de lever : entre 4 h et 10 h, au quart d''heure.';
      end if;
      v_out := jsonb_build_object('before', to_char(v_t, 'HH24:MI'));
    when 'photo' then
      if v ? 'after' and v ->> 'after' is not null then
        v_t := public._hhmm(v ->> 'after');
        if v_t is null then
          raise exception 'Heure invalide.';
        end if;
        v_out := jsonb_build_object('after', to_char(v_t, 'HH24:MI'));
      end if;
    when 'lien' then
      if v ? 'domains' and jsonb_typeof(v -> 'domains') = 'array' then
        v_domains := array(select distinct lower(btrim(x)) from jsonb_array_elements_text(v -> 'domains') x);
        if exists (select 1 from unnest(v_domains) d where not (d = any(public._link_domains()))) then
          raise exception 'Domaine non pris en charge.';
        end if;
        if cardinality(v_domains) > 0 then
          v_out := jsonb_build_object('domains', to_jsonb(v_domains));
        end if;
      end if;
    when 'capture', 'declaratif' then
      null;
    else
      raise exception 'Type de preuve invalide.';
  end case;
  -- Objectif chiffré facultatif, affiché (ex. 20 messages) : preuves faibles seulement.
  if p_proof in ('capture', 'declaratif', 'photo', 'lien') and v ? 'count' and v ->> 'count' is not null then
    v_n := case when v ->> 'count' ~ '^\d{1,4}$' then (v ->> 'count')::int end;
    v_unit := nullif(btrim(coalesce(v ->> 'unit', '')), '');
    if v_n is null or v_n < 1 or v_n > 1000 or length(coalesce(v_unit, '')) > 20 then
      raise exception 'Objectif chiffré invalide.';
    end if;
    v_out := v_out || jsonb_build_object('count', v_n) || case when v_unit is not null then jsonb_build_object('unit', v_unit) else '{}'::jsonb end;
  end if;
  return v_out;
end;
$$;

create or replace function public.set_session_minutes(p_id uuid, p_minutes int) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  e public.enrollments := public._open_enrollment(v_user);
  p public.principles;
  v_then text;
begin
  if p_minutes is null or not public._valid_minutes(p_minutes) then
    raise exception 'Durée invalide.';
  end if;
  select * into p from public.principles where id = p_id and enrollment_id = e.id;
  if e.id is null or p.id is null then
    raise exception 'Principe introuvable.';
  end if;
  if p.proof_type <> 'session' then
    raise exception 'Ce principe demande une autre preuve.';
  end if;
  if (p.target ->> 'minutes')::int = p_minutes then
    return p.id;
  end if;
  if public._used_today(p.id) then
    raise exception 'Déjà validé aujourd''hui.';
  end if;
  v_then := regexp_replace(p.then_text, '\d+(\s?(minutes|minute|min|Minuten|minutos)\y)', p_minutes::text || '\1');
  return public._save_principle(v_user, p.id, p.pillar, p.if_text, v_then, p.proof_type,
    jsonb_set(p.target, '{minutes}', to_jsonb(p_minutes)), p.days, p.difficulty, null, null);
end;
$$;

create or replace function public.start_challenge_session(p_assignment_id uuid, p_minutes int default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  a public.challenge_assignments := public._current_assignment(v_user, p_assignment_id);
  ch public.challenges;
  v_today date := public.paris_today();
  v_now timestamp := public.paris_now();
  v_before time;
  v_code text;
  v_data jsonb := '{}';
  v_nonce text := public._nonce();
  s public.proof_sessions;
begin
  select * into ch from public.challenges where id = a.challenge_id;
  if ch.proof_type not in ('session', 'reps', 'reveil') then
    raise exception 'Cette quête demande une autre preuve.';
  end if;
  if ch.proof_type = 'session' and (p_minutes is null or not public._valid_minutes(p_minutes)) then
    raise exception 'Durée invalide.';
  end if;
  if ch.proof_type = 'reveil' then
    v_before := (ch.rule ->> 'before')::time;
    if ch.rule ? 'isodow' and extract(isodow from v_today)::int <> (ch.rule ->> 'isodow')::int then
      raise exception 'Ce n''est pas le bon jour pour cette quête.';
    end if;
    if v_now < v_today + v_before - interval '2 hours 30 minutes' or v_now > v_today + v_before then
      raise exception 'Ce réveil se prouve entre % et %.',
        public._time_fr(v_before - interval '2 hours 30 minutes'), public._time_fr(v_before);
    end if;
    -- V10 : trois questions de calcul mental, selon le niveau d'études, à la place du code.
    v_data := jsonb_build_object('level', public._math_level((select en.school from public.enrollments en where en.id = a.enrollment_id)));
    v_data := v_data || jsonb_build_object('questions', public._math_questions((v_data ->> 'level')::int));
  elsif ch.proof_type = 'reps' then
    v_data := jsonb_build_object('exercise', coalesce(ch.rule ->> 'exercise', 'pushup'));
  end if;

  perform public._settle_user_sessions(v_user);
  if exists (select 1 from public.proof_sessions where user_id = v_user and status = 'running') then
    raise exception 'Une session est déjà en cours.';
  end if;

  insert into public.proof_sessions (user_id, enrollment_id, challenge_assignment_id, kind, nonce, day, minutes, data)
  values (v_user, a.enrollment_id, a.id, ch.proof_type, v_nonce, v_today,
    case when ch.proof_type = 'session' then p_minutes end, v_data)
  returning * into s;

  return jsonb_build_object(
    'id', s.id, 'nonce', v_nonce, 'kind', s.kind, 'minutes', s.minutes,
    'started_at', s.started_at, 'server_now', now(), 'code', null, 'questions', public._math_public(v_data -> 'questions'), 'target', ch.rule
  );
end;
$$;
