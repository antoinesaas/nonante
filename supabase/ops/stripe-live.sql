-- Stripe en production (compte « nonante » acct_1UNDm7Cp6a83epHq), créé le 9 octobre 2026.
-- Les identifiants live sont rangés à côté de ceux du mode test : l'app prend les uns ou les autres selon la clé
-- STRIPE_SECRET_KEY (sk_live_… ou sk_test_…). Rien ne change tant que la clé live n'est pas sur Vercel.
--   Arc 90 jours  prod_VPR78x2xt0IQUk  19,99 € une fois  price_1UOcFVCp6a83epHqh18ysL8L
--   Pro           prod_VPR8aOAVE2UUMv  14,99 €/mois      price_1UOcGPCp6a83epHqmITVJQxE
--                                      99,99 €/an        price_1UOcHICp6a83epHqKkdm0fVS
--   Fondateur     prod_VPRAP5krquJeih  199 € une fois    price_1UOcI8Cp6a83epHq66ZPU58c
--   Webhook       we_1UOcMFCp6a83epHq7nrDA8nI → https://nonante.fr/api/stripe/webhook (6 événements)
-- Les coupons (nonante-parrainage-20, nonante-fidelite-50) sont créés par l'app au premier besoin.

-- 1. Identifiants live (sans effet en mode test).
update public.settings set value = jsonb_set(jsonb_set(jsonb_set(jsonb_set(value,
    '{arc,once,live_price_id}', '"price_1UOcFVCp6a83epHqh18ysL8L"'),
    '{pro,month,live_price_id}', '"price_1UOcGPCp6a83epHqmITVJQxE"'),
    '{pro,year,live_price_id}', '"price_1UOcHICp6a83epHqKkdm0fVS"'),
    '{fondateur,lifetime,live_price_id}', '"price_1UOcI8Cp6a83epHq66ZPU58c"')
where key = 'plans';

-- 2. Au passage en live seulement (une fois la clé sk_live_ sur Vercel) : les clients et codes de parrainage du
-- mode test n'existent pas en live, l'app les recrée au premier besoin.
-- update public.profiles set stripe_customer_id = null, stripe_promotion_code_id = null, referral_ready = false;
