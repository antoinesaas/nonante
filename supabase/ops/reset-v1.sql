-- À exécuter UNE SEULE FOIS sur une base qui a reçu les migrations V1 (cohortes, pass), avant les migrations V2.
-- Supprime toutes les tables et fonctions du schéma public (les comptes auth.users restent),
-- puis la politique de stockage V1. Les données de jeu V1 sont perdues : à n'utiliser qu'en phase de test.
do $$
declare
  r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('drop table if exists public.%I cascade', r.tablename);
  end loop;
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('drop function if exists %s cascade', r.sig);
  end loop;
end;
$$;

drop policy if exists "proofs : lecture de ses fichiers" on storage.objects;
