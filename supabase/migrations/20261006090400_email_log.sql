-- Un même email (bienvenue, contrôle, récapitulatif, fidélité, bilan) ne part jamais deux fois,
-- même si une tâche planifiée ou un webhook est rejoué.
create table public.email_log (
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('welcome', 'audit', 'weekly', 'loyalty', 'arc_result')),
  ref text not null check (length(ref) <= 100),
  sent_at timestamptz not null default now(),
  primary key (user_id, kind, ref)
);
alter table public.email_log enable row level security;
revoke all on public.email_log from anon, authenticated;

-- true si l'email n'avait jamais été noté (il faut alors l'envoyer).
create function public.log_email_once(p_user uuid, p_kind text, p_ref text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.email_log (user_id, kind, ref) values (p_user, p_kind, p_ref) on conflict do nothing;
  return found;
end;
$$;

revoke execute on function public.log_email_once(uuid, text, text) from public, anon, authenticated;
grant execute on function public.log_email_once(uuid, text, text) to service_role;
