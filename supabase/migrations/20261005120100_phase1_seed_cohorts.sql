-- Cohortes de départ (§12) : une cohorte de test qui démarre aujourd'hui,
-- et l'Arc du 1er janvier, ouvert aux préventes.
insert into public.cohorts (name, start_date, enroll_open)
values
  ('Cohorte de test', (now() at time zone 'Europe/Paris')::date, true),
  ('Arc du 1er janvier', date '2027-01-01', true);
