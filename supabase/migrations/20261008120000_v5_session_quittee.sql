-- V5 : quitter la page du minuteur casse la session (retour, onglet fermé, appli rechargée), comme quitter l'écran.

-- Casse la session de concentration en cours du joueur (− 5). Appelée par la page quand elle est quittée
-- (y compris par navigator.sendBeacon), et quand le joueur revient sur un minuteur resté ouvert.
create or replace function public.leave_session() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := public._require_user();
  v_id uuid;
begin
  select id into v_id from public.proof_sessions
  where user_id = v_user and status = 'running' and kind = 'session'
  for update;
  if v_id is null then
    return jsonb_build_object('status', 'none');
  end if;
  perform public._break_session(v_id, 'Tu as quitté l''écran.');
  return jsonb_build_object('status', 'broken', 'reason', 'Tu as quitté l''écran.');
end;
$$;

revoke execute on function public.leave_session() from public, anon;
grant execute on function public.leave_session() to authenticated;
