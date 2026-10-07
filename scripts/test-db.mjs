// Banc de test de la base : rejoue toutes les migrations dans un Postgres 17 local (PGlite)
// avec des bouchons de l'environnement Supabase (auth, storage, rôles), puis vérifie les règles du jeu,
// l'anti-triche, les plans, la RLS (plusieurs comptes) et l'immuabilité du registre.
// Usage : npm run test:db
import { PGlite } from "@electric-sql/pglite";
import { bootstrap } from "./lib/pglite-supabase.mjs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const db = new PGlite();
const crash = (e) => {
  console.error(`\nErreur inattendue : ${e?.message ?? e}${e?.where ? `\n${e.where}` : ""}`);
  process.exit(1);
};
process.on("unhandledRejection", crash);
process.on("uncaughtException", crash);
let passed = 0;
let failed = 0;

// ---------------------------------------------------------------------------
// Outils
// ---------------------------------------------------------------------------
const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const one = async (sql, params = []) => (await q(sql, params))[0];
const val = async (sql, params = []) => Object.values((await one(sql, params)) ?? {})[0];

function check(label, condition, detail = "") {
  if (condition) {
    passed++;
    console.log(`  ok  ${label}`);
  } else {
    failed++;
    console.log(`  ÉCHEC  ${label} ${detail}`);
  }
}

async function rejects(label, fn, fragment) {
  try {
    await fn();
    check(label, false, "(aucune erreur)");
  } catch (e) {
    const message = e.message ?? String(e);
    check(label, !fragment || message.includes(fragment), `(erreur : ${message})`);
  }
}

async function as(user, fn, { aal = "aal1", role = "authenticated" } = {}) {
  await db.exec(`set role ${role}`);
  await db.query("select set_config('request.jwt.claims', $1, false)", [
    user ? JSON.stringify({ sub: user, role, aal }) : "",
  ]);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claims', '', false)");
  }
}
const service = (fn) => as(null, fn, { role: "service_role" });

// Appel nommé d'une fonction publique, comme PostgREST.
async function rpc(name, args = {}) {
  const keys = Object.keys(args);
  const params = keys.map((k, i) => `${k} := $${i + 1}`).join(", ");
  const row = await one(`select public.${name}(${params}) as r`, keys.map((k) => args[k]));
  return row?.r;
}

await db.exec("set timezone = 'UTC'");

console.log("Migrations");
await bootstrap(db, root, (file, error) => check(file, !error, error?.message ?? ""));

// ---------------------------------------------------------------------------
// Jeu de données
// ---------------------------------------------------------------------------
const id = (n) => `${String(n).repeat(8)}-0000-4000-8000-${String(n).repeat(12)}`;
const [A, B, C, D, E, F, G, H] = [1, 2, 3, 4, 5, 6, 7, 8].map(id);
const ADMIN = "aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa";
await q(`insert into auth.users (id, email) values ($1, 'a@exemple.fr'), ($2, 'b@exemple.fr'), ($3, 'c@exemple.fr'),
  ($4, 'd@exemple.fr'), ($5, 'e@exemple.fr'), ($6, 'f@exemple.fr'), ($7, 'g@exemple.fr'), ($8, 'h@exemple.fr'),
  ($9, 'admin@exemple.fr')`, [A, B, C, D, E, F, G, H, ADMIN]);
const today = await val("select public.paris_today()::text");
await q("update public.settings set value = '0' where key = 'audit_rate'");

const profile = (user, overrides = {}) => as(user, () => rpc("save_profile", {
  p_pseudo: `joueur_${user.slice(0, 4)}`, p_birth_year: 2000, p_adult: true, p_is_public: true,
  p_utm_source: "tiktok", p_utm_campaign: "lancement", ...overrides,
}));
const arc = (user, overrides = {}) => as(user, () => rpc("save_arc", {
  p_category: "business", p_goal_type: "revenu", p_goal_title: "Atteindre 3 000 € par mois avec mon agence",
  p_goal_target: 3000, p_goal_unit: "€", p_goal_public: true, p_weak_points: ["telephone", "vente"],
  p_wake_time: "06:30", p_pushups: "quelques", p_focus_minutes: 90, p_start_date: today, p_squad_id: null, ...overrides,
}));
// Abonnement actif (comme le webhook Stripe).
const subscribe = (user, plan = "pro", status = "active") => service(() => rpc("sync_subscription", {
  p_user: user, p_customer: `cus_${user.slice(0, 4)}`, p_subscription: `sub_${user.slice(0, 4)}_${plan}`, p_plan: plan,
  p_interval: "month", p_status: status, p_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
  p_cancel_at_period_end: false,
}));
// Arc 90 jours payé (comme le webhook Stripe, paiement unique).
const arcPass = (user, ref = `cs_arc_${user.slice(0, 4)}`, loyalty = false) => service(() => rpc("grant_arc_pass", {
  p_user: user, p_object_id: ref, p_amount: 1999, p_currency: "eur", p_customer: `cus_${user.slice(0, 4)}`, p_loyalty: loyalty,
}));
const principlesOf = (enrollment) => q("select * from public.principles where enrollment_id = $1 and active_until is null order by position", [enrollment]);
// Dépose une photo « vérifiée par le serveur » dans le stockage.
const proofFile = async (user) => {
  const path = `${user}/${crypto.randomUUID()}.jpg`;
  await q("insert into storage.objects (bucket_id, name) values ('proofs', $1)", [path]);
  return path;
};
// Arc commencé il y a `daysAgo` jours (dates reculées après coup).
async function pastArc(user, daysAgo, overrides = {}) {
  await profile(user);
  // Arc 90 jours payé avant de construire l'arc : gardé en crédit, puis rattaché au nouvel arc.
  await arcPass(user);
  const enrollment = await arc(user, overrides);
  await q("update public.enrollments set start_date = start_date - $2::int where id = $1", [enrollment, daysAgo]);
  await q("update public.principles set active_from = active_from - $2::int where enrollment_id = $1", [enrollment, daysAgo]);
  return enrollment;
}

// ---------------------------------------------------------------------------
console.log("\nProfil");
await rejects("mineur refusé", () => profile(A, { p_birth_year: 2012 }), "majeures");
await rejects("sans attestation de majorité", () => profile(A, { p_adult: false }), "majeures");
await rejects("pseudo invalide", () => profile(A, { p_pseudo: "A!" }), "Pseudo");
await profile(A);
check("profil créé avec code de parrainage", (await val("select referral_code from public.profiles where id = $1", [A])) === "JOUEUR-1111");
check("source UTM gardée", (await val("select utm_source from public.profiles where id = $1", [A])) === "tiktok");
await rejects("pseudo déjà pris", () => profile(B, { p_pseudo: "joueur_1111" }), "déjà pris");

// ---------------------------------------------------------------------------
console.log("\nConstruire son arc (sans abonnement)");
await rejects("objectif trop court", () => arc(A, { p_goal_title: "x" }), "objectif");
await rejects("point faible inconnu", () => arc(A, { p_weak_points: ["paresse"] }), "Point faible");
await rejects("jour 1 dans le passé", () => arc(A, { p_start_date: "2020-01-01" }), "jour 1");
const enrA = await arc(A);
const eA = await one("select * from public.enrollments where id = $1", [enrA]);
check("arc en construction (draft)", eA.status === "draft" && eA.arc_number === 1);
const pA = await principlesOf(enrA);
const codesA = pA.map((p) => p.template_code);
check("6 principes proposés", pA.length === 6, JSON.stringify(codesA));
check("socle : réveil, travail profond, corps", codesA[0] === "reveil_fixe" && codesA[1] === "bloc_profond" && codesA[2] === "pompes", JSON.stringify(codesA));
check("un principe business pour un objectif de revenu", pA.some((p) => p.pillar === "business"), JSON.stringify(codesA));
check("prospection proposée (point faible : vente)", codesA.includes("prospection"), JSON.stringify(codesA));
check("réveil à l'heure choisie", pA[0].if_text === "S'il est 6 h 30" && pA[0].target.before === "06:30" && pA[0].difficulty === 2);
check("session à la durée choisie (90 min → difficulté 3)", pA[1].target.minutes === 90 && pA[1].difficulty === 3 && pA[1].then_text.includes("90 minutes"));
check("« quelques pompes » : 10 pompes, difficulté 1", pA[2].target.reps === 10 && pA[2].difficulty === 1 && pA[2].then_text === "alors 10 pompes.");
check("chaque principe dit pourquoi il marche", pA.every((p) => p.why && p.why.length > 10));
await rejects("rien ne se valide sans abonnement", () => as(A, () => rpc("validate_declaratif", { p_principle_id: pA[5].id })), "");
check("pas d'activation sans abonnement", (await as(A, () => rpc("activate_my_arc"))) === false);

const examArc = await (async () => { await profile(E); return arc(E, { p_category: "etudes", p_goal_type: "examens", p_goal_title: "Valider mon partiel de droit", p_weak_points: ["procrastination"], p_pushups: "non", p_focus_minutes: 50 }); })();
const codesE = (await principlesOf(examArc)).map((p) => p.template_code);
check("objectif examens : squats et révision active", codesE.includes("squats") && codesE.some((c) => ["revision_active", "grenouille", "fiches", "devoir_jour_meme", "weekend_90"].includes(c)), JSON.stringify(codesE));

// ---------------------------------------------------------------------------
console.log("\nPrincipes personnalisés");
const custom = await as(A, () => rpc("save_principle", {
  p_id: null, p_pillar: "business", p_if: "je finis de déjeuner", p_then: "Alors j'appelle 3 anciens clients.",
  p_proof_type: "declaratif", p_target: JSON.stringify({ count: 3, unit: "appels" }), p_days: [1, 2, 3, 4, 5], p_difficulty: 3,
}));
const pc = await one("select * from public.principles where id = $1", [custom]);
check("textes normalisés", pc.if_text === "Si je finis de déjeuner" && pc.then_text === "alors j'appelle 3 anciens clients.", `${pc.if_text} / ${pc.then_text}`);
check("preuve faible : difficulté plafonnée à 2", pc.difficulty === 2);
check("objectif chiffré gardé", pc.target.count === 3 && pc.target.unit === "appels");
await rejects("durée de session invalide", () => as(A, () => rpc("save_principle", {
  p_id: null, p_pillar: "focus", p_if: "x y", p_then: "travailler", p_proof_type: "session", p_target: JSON.stringify({ minutes: 40 }), p_days: [1], p_difficulty: 1,
})), "25, 50 ou 90");
await rejects("réveil à 11 h refusé", () => as(A, () => rpc("save_principle", {
  p_id: null, p_pillar: "energie", p_if: "il est 11 h", p_then: "debout", p_proof_type: "reveil", p_target: JSON.stringify({ before: "11:00" }), p_days: [1], p_difficulty: 1,
})), "Heure de lever");
await rejects("domaine de lien inconnu", () => as(A, () => rpc("save_principle", {
  p_id: null, p_pillar: "business", p_if: "lundi", p_then: "publier", p_proof_type: "lien", p_target: JSON.stringify({ domains: ["evil.com"] }), p_days: [1], p_difficulty: 1,
})), "Domaine");
await as(A, () => rpc("save_principle", {
  p_id: pA[2].id, p_pillar: "corps", p_if: "je sors du lit", p_then: "50 pompes", p_proof_type: "reps",
  p_target: JSON.stringify({ exercise: "pushup", reps: 50 }), p_days: [1, 2, 3, 4, 5, 6, 7], p_difficulty: 1,
}));
check("avant le jour 1 : modifié directement, difficulté recalculée", (await val("select difficulty from public.principles where id = $1", [pA[2].id])) === 3);
check("pas de nouvelle version avant le départ", (await principlesOf(enrA)).length === 7);
await as(A, () => rpc("remove_principle", { p_id: custom }));
check("retiré avant le départ : supprimé", !(await val("select 1 from public.principles where id = $1", [custom])));
const added = await as(A, () => rpc("add_template_principle", { p_code: "lecture" }));
check("gabarit ajouté depuis la bibliothèque", (await val("select template_code from public.principles where id = $1", [added])) === "lecture");

// ---------------------------------------------------------------------------
console.log("\nAbonnement et lancement");
check("Arc 90 jours payé : enregistré", (await arcPass(A)) === true);
check("Arc 90 jours : paiement compté une seule fois", (await arcPass(A)) === false
  && Number(await val("select count(*) from public.payments where kind = 'arc' and user_id = $1", [A])) === 1);
const eA2 = await one("select * from public.enrollments where id = $1", [enrA]);
check("Arc 90 jours : arc lancé", eA2.status === "active" && eA2.arc_paid && eA2.start_date.toISOString().slice(0, 10) === today);
check("plan effectif : arc", (await val("select public._plan($1)", [A])) === "arc");
check("Arc 90 jours : 6 principes gardés", (await principlesOf(enrA)).length === 6);
check("le principe en trop est le dernier ajouté", !(await val("select 1 from public.principles where id = $1", [added])));
await rejects("Arc 90 jours : pas de 7e principe", () => as(A, () => rpc("add_template_principle", { p_code: "lecture" })), "6 principes");
const plans = await as(null, () => rpc("plans_public"), { role: "anon" });
check("plans publics sans identifiants Stripe", plans.arc.once === 1999 && plans.pro.year === 9999 && !JSON.stringify(plans).includes("price_id"));
check("compteur fondateurs réel", plans.fondateur.limit === 100 && plans.fondateur.sold === 0);

// ---------------------------------------------------------------------------
console.log("\nRLS (plusieurs comptes)");
await profile(B);
const enrB = await arc(B, { p_pushups: "oui", p_weak_points: [] });
await subscribe(B, "pro");
const pB = await principlesOf(enrB);
check("A voit ses principes", (await as(A, () => q("select id from public.principles"))).length >= 6);
check("B ne voit pas ceux de A", (await as(B, () => q("select id from public.principles where enrollment_id = $1", [enrA]))).length === 0);
check("B ne voit pas le profil de A", (await as(B, () => q("select id from public.profiles where id = $1", [A]))).length === 0);
await rejects("les identifiants Stripe ne sont pas lisibles", () => as(A, () => q("select stripe_customer_id from public.profiles")), "permission denied");
await rejects("anon ne lit aucun profil", () => as(null, () => q("select id from public.profiles"), { role: "anon" }), "permission denied");
await rejects("anon ne lit pas les arcs", () => as(null, () => q("select id from public.enrollments"), { role: "anon" }), "permission denied");
await rejects("un utilisateur n'écrit pas dans validations", () => as(A, () => q(
  "insert into public.validations (enrollment_id, principle_id, day, pillar, proof_type, strength, points) values ($1, $2, current_date, 'focus', 'declaratif', 'forte', 999)",
  [enrA, pA[5].id])), "permission denied");
await rejects("un utilisateur ne se donne pas un plan", () => as(A, () => q("update public.profiles set plan = 'pro' where id = $1", [A])), "permission denied");
await rejects("un utilisateur ne s'abonne pas lui-même", () => as(A, () => rpc("sync_subscription", {
  p_user: A, p_customer: "x", p_subscription: "x", p_plan: "pro", p_interval: "month", p_status: "active", p_period_end: null, p_cancel_at_period_end: false,
})), "permission denied");
await rejects("ni ne s'ajoute de revenu prouvé", () => as(A, () => rpc("add_wallet_entry", {
  p_user: A, p_amount_cents: 100, p_source: "vente", p_label: "test", p_day: today, p_proof_path: null,
})), "permission denied");
await rejects("le nonce d'une session n'est pas lisible", () => as(A, () => q("select nonce from public.proof_sessions")), "permission denied");

// ---------------------------------------------------------------------------
console.log("\nValidations et anti-triche");
const declOnly = (await principlesOf(enrA)).find((p) => p.proof_type === "declaratif");
const res1 = await as(A, () => rpc("validate_declaratif", { p_principle_id: declOnly.id }));
check("preuve faible : 50 % des points", res1.points === 5 * declOnly.difficulty, JSON.stringify(res1));
await rejects("deux fois le même jour", () => as(A, () => rpc("validate_declaratif", { p_principle_id: declOnly.id })), "Déjà validé");
await rejects("pour un autre utilisateur", () => as(B, () => rpc("validate_declaratif", { p_principle_id: declOnly.id })), "introuvable");
await rejects("sans la bonne preuve", () => as(A, () => rpc("validate_declaratif", { p_principle_id: pA[1].id })), "autre preuve");
await rejects("sans être connecté", () => as(null, () => rpc("validate_declaratif", { p_principle_id: declOnly.id }), { role: "anon" }), "permission denied");
const reps = await as(A, () => rpc("validate_declaratif", { p_principle_id: pA[2].id }));
check("pompes sans caméra : repli déclaratif à 50 %", reps.points === 15, JSON.stringify(reps));
check("le pilier est noté sur la validation", (await val("select pillar from public.validations where id = $1", [reps.validation_id])) === "corps");
const capture = (await principlesOf(enrA)).find((p) => p.proof_type === "capture");
if (capture) {
  const path = await proofFile(A);
  await rejects("capture d'un autre utilisateur refusée", () => service(() => rpc("validate_photo", { p_user: A, p_principle_id: capture.id, p_path: `${B}/x.jpg` })), "introuvable");
  const cap = await service(() => rpc("validate_photo", { p_user: A, p_principle_id: capture.id, p_path: path }));
  check("capture : preuve faible", cap.points === 5 * capture.difficulty);
}

// ---------------------------------------------------------------------------
console.log("\nRegistre des points (ajout seul)");
await rejects("authenticated ne modifie pas le registre", () => as(A, () => q("update public.points_ledger set delta = 1000")), "permission denied");
await rejects("authenticated ne supprime pas", () => as(A, () => q("delete from public.points_ledger")), "permission denied");
await rejects("authenticated n'insère pas", () => as(A, () => q(
  "insert into public.points_ledger (enrollment_id, user_id, day, delta, reason, ref_id) values ($1, $2, current_date, 999, 'validation', gen_random_uuid())", [enrA, A])), "permission denied");
await rejects("service_role ne modifie pas non plus", () => service(() => q("update public.points_ledger set delta = 1000")), "permission denied");
await rejects("même le propriétaire ne peut pas modifier (trigger)", () => q("update public.points_ledger set delta = 1000"), "ajout seul");
await rejects("ni vider la table", () => q("truncate public.points_ledger"), "ajout seul");
await rejects("une validation est définitive", () => q("update public.validations set points = 99"), "définitive");

// ---------------------------------------------------------------------------
console.log("\nModifier un principe pendant l'arc");
const before = (await principlesOf(enrA)).length;
const v2 = await as(A, () => rpc("save_principle", {
  p_id: declOnly.id, p_pillar: declOnly.pillar, p_if: declOnly.if_text, p_then: "une nouvelle version", p_proof_type: "declaratif",
  p_target: "{}", p_days: [1, 2, 3, 4, 5, 6, 7], p_difficulty: 2,
}));
const oldVersion = await one("select * from public.principles where id = $1", [declOnly.id]);
const newVersion = await one("select * from public.principles where id = $1", [v2]);
check("l'ancienne version s'arrête ce soir", oldVersion.active_until.toISOString().slice(0, 10) === today);
check("la nouvelle commence demain, même position", newVersion.active_from > oldVersion.active_from && newVersion.position === oldVersion.position);
check("la validation d'aujourd'hui reste", Boolean(await val("select 1 from public.validations where principle_id = $1", [declOnly.id])));
check("toujours le même nombre de principes", (await principlesOf(enrA)).length === before);
const dashTomorrow = await as(A, () => rpc("my_principles"));
check("onglet Principes : la version de demain", dashTomorrow.started && dashTomorrow.principles.some((p) => p.id === v2 && p.pending));
await as(A, () => rpc("remove_principle", { p_id: pA[0].id }));
check("retiré pendant l'arc : s'arrête ce soir", (await val("select active_until::text from public.principles where id = $1", [pA[0].id])) === today);
await rejects("modifier le principe d'un autre", () => as(B, () => rpc("remove_principle", { p_id: v2 })), "introuvable");

// ---------------------------------------------------------------------------
console.log("\nLiens");
const linkP = await as(B, () => rpc("save_principle", {
  p_id: null, p_pillar: "business", p_if: "c'est un jour", p_then: "je publie", p_proof_type: "lien",
  p_target: JSON.stringify({ domains: ["tiktok.com", "youtube.com"] }), p_days: [1, 2, 3, 4, 5, 6, 7], p_difficulty: 2,
}));
// Ajouté pendant l'arc : valable demain. On l'avance à aujourd'hui pour le test.
await q("update public.principles set active_from = public.paris_today() where id = $1", [linkP]);
await rejects("domaine non autorisé", () => as(B, () => rpc("validate_link", { p_principle_id: linkP, p_url: "https://evil.com/x" })), "doit venir de");
await rejects("http refusé", () => as(B, () => rpc("validate_link", { p_principle_id: linkP, p_url: "http://tiktok.com/@a/video/1" })), "https");
await rejects("lien vers le site, pas une publication", () => as(B, () => rpc("validate_link", { p_principle_id: linkP, p_url: "https://www.tiktok.com/" })), "publication");
await rejects("identifiants dans l'URL refusés", () => as(B, () => rpc("validate_link", { p_principle_id: linkP, p_url: "https://tiktok.com@evil.com/x" })), "invalide");
const link1 = await as(B, () => rpc("validate_link", { p_principle_id: linkP, p_url: "https://www.TikTok.com/@nonante/video/123/#top" }));
check("lien valide : 50 %", link1.points === 10);
check("lien normalisé", (await val("select link_url from public.validations where id = $1", [link1.validation_id])) === "https://www.tiktok.com/@nonante/video/123");

// ---------------------------------------------------------------------------
console.log("\nMinuteur de concentration");
const bureau = pB.find((p) => p.template_code === "bloc_profond");
const s1 = await as(B, () => rpc("start_proof_session", { p_principle_id: bureau.id }));
check("session créée avec nonce", s1.nonce?.length === 64 && s1.minutes === 90);
await rejects("une seule session à la fois", () => as(B, () => rpc("start_proof_session", { p_principle_id: bureau.id })), "déjà en cours");
await rejects("mauvais nonce", () => as(B, () => rpc("heartbeat", { p_session_id: s1.id, p_nonce: "x", p_visible: true, p_hidden_ms: 0 })), "introuvable");
const hb = await as(B, () => rpc("heartbeat", { p_session_id: s1.id, p_nonce: s1.nonce, p_visible: true, p_hidden_ms: 0 }));
check("battement compté", hb.status === "running" && hb.heartbeats === 1);
await rejects("finir avant l'heure", () => as(B, () => rpc("complete_session", { p_session_id: s1.id, p_nonce: s1.nonce })), "pas terminée");
await q("update public.proof_sessions set started_at = now() - interval '91 minutes', heartbeats = 100, last_heartbeat_at = now() - interval '5 seconds' where id = $1", [s1.id]);
const broken = await as(B, () => rpc("complete_session", { p_session_id: s1.id, p_nonce: s1.nonce }));
check("moins de 90 % des battements : session cassée, − 5", broken.status === "broken"
  && (await val("select delta from public.points_ledger where reason = 'session_broken' and ref_id = $1", [s1.id])) === -5);
const s2 = await as(B, () => rpc("start_proof_session", { p_principle_id: bureau.id }));
const hidden = await as(B, () => rpc("heartbeat", { p_session_id: s2.id, p_nonce: s2.nonce, p_visible: true, p_hidden_ms: 11000 }));
check("11 s hors de l'écran : session cassée", hidden.status === "broken");
const s3 = await as(B, () => rpc("start_proof_session", { p_principle_id: bureau.id }));
await q("update public.proof_sessions set started_at = now() - interval '90 minutes 5 seconds', heartbeats = 360, last_heartbeat_at = now() - interval '5 seconds' where id = $1", [s3.id]);
const done = await as(B, () => rpc("complete_session", { p_session_id: s3.id, p_nonce: s3.nonce }));
check("session complète : preuve forte, 100 %", done.status === "completed" && done.validation.points === 30, JSON.stringify(done));

// ---------------------------------------------------------------------------
console.log("\nRépétitions et réveil");
const pompesB = pB.find((p) => p.template_code === "pompes");
check("« je fais des pompes » : 20 pompes", pompesB.target.reps === 20 && pompesB.difficulty === 2);
const r1 = await as(B, () => rpc("start_proof_session", { p_principle_id: pompesB.id }));
await q("update public.proof_sessions set started_at = now() - interval '90 seconds' where id = $1", [r1.id]);
const fast = Array.from({ length: 20 }, (_, i) => [i * 1000, i * 1000 + 500]);
check("répétition de moins de 0,8 s refusée", (await as(B, () => rpc("complete_reps", { p_session_id: r1.id, p_nonce: r1.nonce, p_reps: JSON.stringify(fast) }))).status === "rejected");
const r2 = await as(B, () => rpc("start_proof_session", { p_principle_id: pompesB.id }));
await q("update public.proof_sessions set started_at = now() - interval '90 seconds' where id = $1", [r2.id]);
const few = Array.from({ length: 12 }, (_, i) => [i * 2000, i * 2000 + 1200]);
const rFew = await as(B, () => rpc("complete_reps", { p_session_id: r2.id, p_nonce: r2.nonce, p_reps: JSON.stringify(few) }));
check("objectif non atteint refusé", rFew.status === "rejected" && rFew.reason.includes("12 sur 20"));
const r3 = await as(B, () => rpc("start_proof_session", { p_principle_id: pompesB.id }));
await q("update public.proof_sessions set started_at = now() - interval '60 seconds' where id = $1", [r3.id]);
const good = Array.from({ length: 20 }, (_, i) => [i * 2000, i * 2000 + 1500]);
const rGood = await as(B, () => rpc("complete_reps", { p_session_id: r3.id, p_nonce: r3.nonce, p_reps: JSON.stringify(good) }));
check("20 pompes valides : preuve forte", rGood.status === "completed" && rGood.validation.points === 20, JSON.stringify(rGood));
const reveilB = pB.find((p) => p.proof_type === "reveil");
if (await val("select public.paris_now()::time > '22:59'")) {
  console.log("  (test du réveil sauté : trop près de minuit)");
} else {
  await q("update public.principles set target = jsonb_build_object('before', to_char(public.paris_now() + interval '1 hour', 'HH24:MI')) where id = $1", [reveilB.id]);
  const w = await as(B, () => rpc("start_proof_session", { p_principle_id: reveilB.id }));
  check("code à 6 chiffres", /^\d{6}$/.test(w.code));
  const wrong = await as(B, () => rpc("complete_wake_check", { p_session_id: w.id, p_nonce: w.nonce, p_code: w.code === "000000" ? "111111" : "000000" }));
  check("mauvais code refusé", wrong.status === "running" && wrong.error === "Code incorrect.");
  const ok = await as(B, () => rpc("complete_wake_check", { p_session_id: w.id, p_nonce: w.nonce, p_code: w.code }));
  check("bon code : preuve forte", ok.status === "completed" && ok.validation.points === 10 * reveilB.difficulty, JSON.stringify(ok));
}

// ---------------------------------------------------------------------------
console.log("\nJokers");
const j1 = await as(A, () => rpc("use_joker"));
check("Arc 90 jours : un joker posé, 0 restant", j1.jokers_left === 0);
await rejects("pas de second joker avec l'Arc 90 jours", () => as(A, () => rpc("use_joker")), "Plus de joker");
const j2 = await as(B, () => rpc("use_joker"));
check("Pro : 3 jokers", j2.jokers_left === 2);
await rejects("un joker par jour", () => as(B, () => rpc("use_joker")), "déjà posé");

// ---------------------------------------------------------------------------
console.log("\nPortefeuille");
await rejects("Arc 90 jours : portefeuille réservé à Pro", () => service(() => rpc("add_wallet_entry", {
  p_user: A, p_amount_cents: 5000, p_source: "vente", p_label: "Site vitrine", p_day: today, p_proof_path: null,
})), "plan Pro");
const w1 = await service(() => rpc("add_wallet_entry", { p_user: B, p_amount_cents: 12000, p_source: "client", p_label: "Acompte client", p_day: today, p_proof_path: null }));
check("revenu sans capture : noté, non prouvé, pas de points", w1.status === "declared" && w1.points === 0);
const path1 = await proofFile(B);
const w2 = await service(() => rpc("add_wallet_entry", { p_user: B, p_amount_cents: 45000, p_source: "vente", p_label: "Formation vendue", p_day: today, p_proof_path: path1 }));
check("revenu prouvé : + 15", w2.status === "proven" && w2.points === 15);
const path2 = await proofFile(B);
const w3 = await service(() => rpc("add_wallet_entry", { p_user: B, p_amount_cents: 60000, p_source: "vente", p_label: "Deuxième vente", p_day: today, p_proof_path: path2 }));
check("+ 15 une seule fois par jour", w3.points === 0);
await rejects("montant invalide", () => service(() => rpc("add_wallet_entry", { p_user: B, p_amount_cents: 0, p_source: "vente", p_label: "x x", p_day: today, p_proof_path: null })), "Montant");
const wallet = await as(B, () => rpc("my_wallet"));
check("totaux du portefeuille", wallet.proven_cents === 105000 && wallet.declared_cents === 12000 && wallet.enabled, JSON.stringify({ p: wallet.proven_cents, d: wallet.declared_cents }));
await rejects("un revenu prouvé ne se retire pas", () => as(B, () => rpc("delete_wallet_entry", { p_id: w2.id })), "non prouvé");
await as(B, () => rpc("delete_wallet_entry", { p_id: w1.id }));
check("un revenu non prouvé se retire", !(await val("select 1 from public.wallet_entries where id = $1", [w1.id])));
const statsB = await one("select * from public.player_stats where user_id = $1", [B]);
check("succès « Premier euro » et « Cent » débloqués", Number(await val("select count(*) from public.user_achievements ua join public.achievements a on a.id = ua.achievement_id where ua.user_id = $1 and a.code in ('premier_euro', 'cent_euros')", [B])) === 2);
check("stats : revenus prouvés et stat Business", Number(statsB.wallet_proven_cents) === 105000 && statsB.business > 0, JSON.stringify(statsB));

// ---------------------------------------------------------------------------
console.log("\nContrôles");
await q("update public.settings set value = '1' where key = 'audit_rate'");
const extra = await as(B, () => rpc("save_principle", {
  p_id: null, p_pillar: "esprit", p_if: "test", p_then: "test", p_proof_type: "declaratif", p_target: "{}", p_days: [1, 2, 3, 4, 5, 6, 7], p_difficulty: 2,
}));
await q("update public.principles set active_from = public.paris_today() where id = $1", [extra]);
const audited = await as(B, () => rpc("validate_declaratif", { p_principle_id: extra }));
check("contrôle déclenché", audited.audit === true);
const audit = await one("select * from public.audits where validation_id = $1", [audited.validation_id]);
await q("update public.audits set due_at = now() - interval '1 minute' where id = $1", [audit.id]);
check("contrôle expiré traité", (await service(() => rpc("cron_expire_audits"))) === 1);
check("pénalité − 3 × valeur", (await val("select delta from public.points_ledger where reason = 'audit_failed' and ref_id = $1", [audit.id])) === -60);
check("preuves refusées +1", (await val("select refused_proofs from public.profiles where id = $1", [B])) === 1);
const path3 = await proofFile(B);
const w4 = await service(() => rpc("add_wallet_entry", { p_user: B, p_amount_cents: 1000, p_source: "autre", p_label: "Douteux", p_day: today, p_proof_path: path3 }));
check("revenu contrôlé", w4.status === "audit_pending");
await q("update public.settings set value = '0' where key = 'audit_rate'");

// ---------------------------------------------------------------------------
console.log("\nAdmin et double authentification");
await q("insert into public.profiles (id, pseudo, birth_year, is_admin) values ($1, 'admin', 1990, true)", [ADMIN]);
await rejects("sans aal2 : refusé", () => as(ADMIN, () => rpc("admin_overview")), "Double authentification");
await rejects("non admin : refusé", () => as(A, () => rpc("admin_overview"), { aal: "aal2" }), "réservé");
const queue = await as(ADMIN, () => rpc("admin_audit_queue"), { aal: "aal2" });
const walletAudit = queue.find((x) => x.wallet);
check("file des contrôles : le revenu y est", Boolean(walletAudit), JSON.stringify(queue));
await as(ADMIN, () => rpc("admin_review_audit", { p_audit_id: walletAudit.id, p_pass: false }), { aal: "aal2" });
check("revenu refusé : rejeté, − 30", (await val("select status from public.wallet_entries where id = $1", [w4.id])) === "rejected"
  && (await val("select delta from public.points_ledger where reason = 'wallet_audit_failed' and ref_id = $1", [walletAudit.id])) === -30);
const overview = await as(ADMIN, () => rpc("admin_overview"), { aal: "aal2" });
check("vue d'ensemble : revenu mensuel (Pro) et arcs vendus", overview.mrr_cents === 1499 && overview.arc_passes_total >= 1, JSON.stringify(overview.subscribers));
await as(ADMIN, () => rpc("admin_grant_comp", { p_pseudo: "joueur_5555", p_plan: "pro", p_until: "2099-01-01" }), { aal: "aal2" });
check("accès offert : l'arc d'E est lancé", (await val("select status from public.enrollments where id = $1", [examArc])) === "active");
check("action journalisée", Number(await val("select count(*) from public.audit_log where action = 'comp_grant'")) === 1);

// ---------------------------------------------------------------------------
console.log("\nFacturation");
check("paiement noté une seule fois", (await service(() => rpc("record_payment", { p_object_id: "in_1", p_user: B, p_kind: "subscription", p_plan: "pro", p_interval: "month", p_amount: 1499, p_currency: "eur" }))) === true
  && (await service(() => rpc("record_payment", { p_object_id: "in_1", p_user: B, p_kind: "subscription", p_plan: "pro", p_interval: "month", p_amount: 1499, p_currency: "eur" }))) === false);
check("la source UTM suit le paiement", (await val("select utm_source from public.payments where stripe_object_id = 'in_1'")) === "tiktok");
await service(() => rpc("set_referral_promo", { p_user: A, p_promotion_code_id: "promo_A" }));
const ref = await service(() => rpc("record_referral", { p_promotion_code_id: "promo_A", p_referred: B, p_object_id: "cs_B" }));
check("parrainage noté, parrain renvoyé", ref?.referrer_id === A);
check("parrainage compté une fois", (await service(() => rpc("record_referral", { p_promotion_code_id: "promo_A", p_referred: B, p_object_id: "cs_B" }))) === null);
check("pas d'auto-parrainage", (await service(() => rpc("record_referral", { p_promotion_code_id: "promo_A", p_referred: A, p_object_id: "cs_A" }))) === null);
await service(() => rpc("sync_subscription", { p_user: null, p_customer: "cus_2222", p_subscription: "sub_old", p_plan: "pro", p_interval: "month", p_status: "canceled", p_period_end: null, p_cancel_at_period_end: false }));
check("événement d'un ancien abonnement ignoré", (await val("select plan_status from public.profiles where id = $1", [B])) === "active");
await profile(F);
await service(() => rpc("grant_lifetime", { p_user: F, p_customer: "cus_F" }));
check("fondateur : accès à vie", (await val("select public._plan($1)", [F])) === "fondateur");
await service(() => rpc("sync_subscription", { p_user: F, p_customer: "cus_F", p_subscription: "sub_F", p_plan: "pro", p_interval: "month", p_status: "canceled", p_period_end: null, p_cancel_at_period_end: false }));
check("un abonnement ne retire pas l'accès à vie", (await val("select public._plan($1)", [F])) === "fondateur");
check("compteur fondateurs", (await as(null, () => rpc("plans_public"), { role: "anon" })).fondateur.sold === 1);
check("Arc 90 jours payé d'avance : gardé en crédit", (await arcPass(F, "cs_arc_F")) === true
  && (await val("select arc_credits from public.profiles where id = $1", [F])) === 1);
await service(() => rpc("mark_loyalty_applied", { p_enrollment: enrA, p_pending: true }));
check("fidélité sans abonnement : remise en attente", (await val("select loyalty_pending from public.profiles where id = $1", [A])) === true);
await arcPass(A, "cs_arc_A_2", true);
check("remise de fidélité consommée par l'arc suivant", (await val("select loyalty_pending from public.profiles where id = $1", [A])) === false
  && (await val("select arc_credits from public.profiles where id = $1", [A])) === 1);
await q("update public.profiles set arc_credits = 0 where id = $1", [A]);

console.log("\nQuestionnaire (visiteur, sans compte)");
const preview = await as(null, () => rpc("preview_principles", {
  p_category: "business", p_goal_type: "revenu", p_weak_points: ["telephone", "vente"], p_wake_time: "06:30", p_pushups: "quelques", p_focus_minutes: 90,
}), { role: "anon" });
check("aperçu : les 6 mêmes principes que l'arc construit", preview.principles.map((p) => p.code).join() === codesA.join(), JSON.stringify(preview.principles.map((p) => p.code)));
check("aperçu : textes et difficulté calculés", preview.principles[0].if_text === "S'il est 6 h 30" && preview.principles[1].difficulty === 3 && preview.templates >= 30);
await rejects("aperçu : réponses invalides refusées", () => as(null, () => rpc("preview_principles", {
  p_category: "x", p_goal_type: "revenu", p_weak_points: [], p_wake_time: "06:30", p_pushups: "oui", p_focus_minutes: 50,
}), { role: "anon" }), "incomplètes");
const proof = await as(null, () => rpc("social_proof"), { role: "anon" });
check("preuve sociale : chiffres réels", typeof proof.joueurs === "number" && Array.isArray(proof.joueurs_en_forme) && proof.templates >= 30);
await rejects("réponses en attente : illisibles pour un visiteur", () => as(null, () => q("select * from public.pending_arcs"), { role: "anon" }), "permission denied");
await rejects("réponses en attente : illisibles pour un joueur", () => as(A, () => q("select * from public.pending_arcs")), "permission denied");

// ---------------------------------------------------------------------------
console.log("\nClôture des jours");
const enrD = await pastArc(D, 10, { p_pushups: "oui", p_weak_points: [] });
const pD = await principlesOf(enrD);
const dueOn = (p, offset) => val("select public._on_day($1::date, $2::date, $3::int[], public.paris_today() - $4::int)", [p.active_from, p.active_until, p.days, offset]);
// J-10 : tout validé. J-9 : app ouverte, rien validé. J-8 : jour blanc. J-7 à J-1 : tout validé.
for (const offset of [10, 7, 6, 5, 4, 3, 2, 1]) {
  for (const p of pD) {
    if (await dueOn(p, offset)) {
      await q("insert into public.validations (enrollment_id, principle_id, day, pillar, proof_type, strength, points) values ($1, $2, public.paris_today() - $3::int, $4, 'declaratif', 'faible', 0)", [enrD, p.id, offset, p.pillar]);
    }
  }
}
await q("insert into public.app_opens (enrollment_id, day) values ($1, public.paris_today() - 9)", [enrD]);
const closed = await service(() => rpc("cron_close_days"));
check("10 jours clôturés", closed >= 10, String(closed));
const statuses = (await q("select status from public.day_status where enrollment_id = $1 order by day", [enrD])).map((r) => r.status);
check("vert, rouge, blanc, puis vert", statuses.slice(0, 4).join(",") === "green,red,white,green", statuses.join(","));
const miss9 = await one("select * from public.misses where enrollment_id = $1 and day = public.paris_today() - 9 and principle_id = $2", [enrD, pD[0].id]);
const miss8 = await one("select * from public.misses where enrollment_id = $1 and day = public.paris_today() - 8 and principle_id = $2", [enrD, pD[0].id]);
check("raté : − valeur", miss9.points === -10 * pD[0].difficulty && miss9.streak === 1, JSON.stringify(miss9));
check("raté deux jours d'affilée et jour blanc : − 2 × valeur", miss8.points === -20 * pD[0].difficulty && miss8.streak === 2 && miss8.white);
check("idempotent : rien de plus au second passage", (await service(() => rpc("cron_close_days"))) === 0);
check("premier vert débloqué", Boolean(await val("select 1 from public.user_achievements ua join public.achievements a on a.id = ua.achievement_id where a.code = 'premier_vert' and ua.user_id = $1", [D])));
const sD = await one("select * from public.player_stats where user_id = $1", [D]);
check("série : 7 jours verts", sD.streak === 7, JSON.stringify(sD));
check("discipline = jours verts / jours clos", sD.discipline === Math.round(99 * 8 / 10), String(sD.discipline));
check("XP = somme des gains, niveau calculé", sD.xp === Number(await val("select coalesce(sum(delta), 0) from public.points_ledger where user_id = $1 and delta > 0", [D]))
  && sD.level === Math.floor(Math.sqrt(sD.xp / 50)) + 1);

// Joker : journée neutre, la série continue.
const enrG = await pastArc(G, 3, { p_weak_points: [] });
const pG = await principlesOf(enrG);
for (const offset of [3, 1]) {
  for (const p of pG) {
    if (await dueOn(p, offset)) {
      await q("insert into public.validations (enrollment_id, principle_id, day, pillar, proof_type, strength, points) values ($1, $2, public.paris_today() - $3::int, $4, 'declaratif', 'faible', 0)", [enrG, p.id, offset, p.pillar]);
    }
  }
}
await q("insert into public.joker_days (enrollment_id, day) values ($1, public.paris_today() - 2)", [enrG]);
await service(() => rpc("cron_close_days"));
const gStatuses = (await q("select status from public.day_status where enrollment_id = $1 order by day", [enrG])).map((r) => r.status);
check("vert, joker, vert", gStatuses.join(",") === "green,joker,green", gStatuses.join(","));
check("joker : aucune pénalité", Number(await val("select count(*) from public.misses where enrollment_id = $1", [enrG])) === 0);
check("joker : la série continue (2)", (await val("select streak from public.player_stats where user_id = $1", [G])) === 2);

// Abandon : 7 jours blancs d'affilée.
const enrH = await pastArc(H, 8);
await service(() => rpc("cron_close_days"));
check("7 jours blancs : abandon", (await val("select status from public.enrollments where id = $1", [enrH])) === "abandoned");
const enrH2 = await arc(H);
check("après un abandon : on recommence (arc n° 2)", (await val("select arc_number from public.enrollments where id = $1", [enrH2])) === 2);
check("arc n° 2 : un nouvel Arc 90 jours à payer", (await val("select status from public.enrollments where id = $1", [enrH2])) === "draft"
  && (await val("select public._plan($1)", [H])) === null);
await arcPass(H, "cs_arc_H_2");
check("arc n° 2 payé : lancé", (await val("select status from public.enrollments where id = $1", [enrH2])) === "active");

// Fin d'arc : arc tenu.
await q("update public.enrollments set start_date = public.paris_today() - 90 where id = $1", [enrH2]);
await q("update public.principles set active_from = public.paris_today() - 90 where enrollment_id = $1", [enrH2]);
await q("insert into public.day_status (enrollment_id, day, status, opened_app) select $1, d::date, case when extract(day from d) = 1 then 'red' else 'green' end, true from generate_series(public.paris_today() - 90, public.paris_today() - 2, interval '1 day') d", [enrH2]);
const lastP = (await principlesOf(enrH2));
for (const p of lastP) {
  if (await dueOn(p, 1)) {
    await q("insert into public.validations (enrollment_id, principle_id, day, pillar, proof_type, strength, points) values ($1, $2, public.paris_today() - 1, $3, 'declaratif', 'faible', 0)", [enrH2, p.id, p.pillar]);
  }
}
await service(() => rpc("cron_close_days"));
check("jour 90 clos : arc tenu", (await val("select status from public.enrollments where id = $1", [enrH2])) === "completed");
check("+ 500 une seule fois", Number(await val("select sum(delta) from public.points_ledger where reason = 'arc_completed' and enrollment_id = $1", [enrH2])) === 500);
check("succès « Arc tenu »", Boolean(await val("select 1 from public.user_achievements ua join public.achievements a on a.id = ua.achievement_id where a.code = 'arc_tenu' and ua.user_id = $1", [H])));
const loyalty = await service(() => q("select * from public.cron_loyalty_targets()"));
check("arc tenu : remise de fidélité à appliquer", loyalty.some((x) => x.enrollment_id === enrH2));

// ---------------------------------------------------------------------------
console.log("\nEscouades");
await rejects("Arc 90 jours : création réservée à Pro", () => as(A, () => rpc("create_squad", { p_name: "Les lève-tôt", p_description: null, p_is_public: false })), "plan Pro");
const code = await as(B, () => rpc("create_squad", { p_name: "Les lève-tôt", p_description: "Debout avant 6 h", p_is_public: false }));
check("code d'escouade sur 6 caractères", /^[A-Z0-9]{6}$/.test(code));
const squadId = await as(A, () => rpc("join_squad", { p_code: code.toLowerCase() }));
check("rejoindre par code", Boolean(squadId));
await rejects("code inconnu", () => as(D, () => rpc("join_squad", { p_code: "ZZZZZZ" })), "inconnu");
check("succès « Escouade »", Boolean(await val("select 1 from public.user_achievements ua join public.achievements a on a.id = ua.achievement_id where a.code = 'escouade' and ua.user_id = $1", [A])));
check("escouade privée invisible pour un non-membre", (await as(D, () => q("select * from public.leaderboard('semaine', null, $1)", [squadId]))).length === 0);
const squadBoard = await as(A, () => q("select * from public.leaderboard('semaine', null, $1)", [squadId]));
check("classement de l'escouade : ses 2 membres", squadBoard.length === 2, JSON.stringify(squadBoard));
const official = await val("select id from public.squads where is_official");
await as(D, () => rpc("join_public_squad", { p_id: official }));
check("escouade officielle rejointe", Boolean(await val("select 1 from public.squad_members where squad_id = $1 and user_id = $2", [official, D])));
const starts = await as(null, () => rpc("collective_starts"), { role: "anon" });
check("départ collectif du 1er janvier proposé", starts.some((s) => s.start_date === "2027-01-01"));
await as(B, () => rpc("leave_squad", { p_id: squadId }));
check("le créateur part : A devient propriétaire", (await val("select owner_id from public.squads where id = $1", [squadId])) === A);

// ---------------------------------------------------------------------------
console.log("\nClassement, profils et statistiques honnêtes");
const board = await as(null, () => q("select * from public.leaderboard('total', null, null)"), { role: "anon" });
const sumB = Number(await val("select coalesce(sum(delta), 0) from public.points_ledger where user_id = $1", [B]));
check("points du classement = somme du registre", board.find((r) => r.pseudo === "joueur_2222")?.points === sumB, JSON.stringify(board.slice(0, 3)));
check("les arcs en construction n'apparaissent pas", !board.some((r) => r.pseudo === "joueur_6666"));
const stats = await as(null, () => one("select * from public.global_stats()"), { role: "anon" });
check("joueurs = vrai nombre en base", stats.joueurs === Number(await val("select count(distinct user_id) from public.enrollments where status <> 'draft'")), JSON.stringify(stats));
check("abandons et arcs tenus réels", stats.ont_lache === 1 && stats.arcs_tenus === 1, JSON.stringify(stats));
const pub = await as(null, () => rpc("public_profile", { p_pseudo: "joueur_2222" }), { role: "anon" });
check("profil public : carte de joueur sans email", pub?.stats?.level >= 1 && !JSON.stringify(pub).includes("@exemple"));
check("portefeuille masqué par défaut", pub.wallet_proven_cents === null);
await as(B, () => rpc("update_profile_settings", { p_is_public: null, p_art_slug: null, p_email_reminders: null, p_wallet_public: true, p_bio: "Agence web. 90 jours." }));
check("portefeuille public si choisi", (await as(null, () => rpc("public_profile", { p_pseudo: "joueur_2222" }), { role: "anon" })).wallet_proven_cents === 105000);
await rejects("fond non débloqué refusé", () => as(B, () => rpc("update_profile_settings", { p_is_public: null, p_art_slug: "adams-tetons", p_email_reminders: null, p_wallet_public: null, p_bio: null })), "débloqué");
await q("update public.profiles set is_public = false where id = $1", [A]);
check("profil privé invisible", (await as(null, () => rpc("public_profile", { p_pseudo: "joueur_1111" }), { role: "anon" })) === null);
check("pseudo masqué au classement", (await as(null, () => q("select pseudo from public.leaderboard('total', null, null)"), { role: "anon" })).some((r) => r.pseudo === "Anonyme"));

// ---------------------------------------------------------------------------
console.log("\nTableau de bord et quêtes");
const dash = await as(B, () => rpc("my_dashboard"));
check("tableau de bord : jour 1, en cours", dash.state === "running" && dash.day_number === 1, JSON.stringify({ state: dash.state, day: dash.day_number }));
check("calendrier de 90 jours", dash.calendar.length === 90 && dash.calendar[0].status === "today");
check("stats de joueur incluses", dash.stats.level >= 1 && typeof dash.stats.ovr === "number");
check("plan Pro et jokers", dash.plan.plan === "pro" && dash.enrollment.jokers_total === 3 && dash.joker_today === true);
check("quête de la semaine attribuée", Boolean(dash.challenge?.assignment_id), JSON.stringify(dash.challenge));
const assignment = await one("select * from public.challenge_assignments where enrollment_id = $1", [enrB]);
await q("update public.challenge_assignments set challenge_id = (select id from public.challenges where code = 'business_n1_trois') where id = $1", [assignment.id]);
const ch1 = await as(B, () => rpc("validate_challenge_declaratif", { p_assignment_id: assignment.id }));
check("quête déclarative réussie : + 100", ch1.status === "done" && (await val("select delta from public.points_ledger where reason = 'challenge' and ref_id = $1", [assignment.id])) === 100);
await rejects("quête déjà jugée", () => as(B, () => rpc("validate_challenge_declaratif", { p_assignment_id: assignment.id })), "déjà jugée");
const locked = await subscribe(E, "pro", "canceled");
await q("update public.profiles set comp_until = null, comp_plan = null where id = $1", [E]);
check("abonnement résilié : arc verrouillé", (await as(E, () => rpc("my_dashboard"))).state === "locked", String(locked));
const pE = await principlesOf(examArc);
await rejects("verrouillé : plus rien ne se valide", () => as(E, () => rpc("validate_declaratif", { p_principle_id: pE.find((p) => p.proof_type === "declaratif")?.id ?? pE[0].id })), "");

// ---------------------------------------------------------------------------
await q("update public.enrollments set status = 'completed', closed_at = now() where id = $1", [enrA]);
check("Arc 90 jours terminé : plus d'accès sans nouvel arc payé", (await val("select public._plan($1)", [A])) === null);

// ---------------------------------------------------------------------------
console.log("\nSuppression de compte (RGPD)");
const files = await as(B, () => rpc("delete_my_account"));
check("compte supprimé, fichiers à effacer renvoyés", files.proofs.length >= 3 && !(await val("select 1 from public.profiles where id = $1", [B])));
check("ses points aussi", Number(await val("select count(*) from public.points_ledger where user_id = $1", [B])) === 0);
check("les paiements restent, détachés", (await val("select user_id from public.payments where stripe_object_id = 'in_1'")) === null);
await rejects("le drapeau ne fuit pas hors de la transaction", () => q("delete from public.points_ledger"), "ajout seul");

console.log(`\n${passed} réussis, ${failed} échoués.`);
process.exit(failed ? 1 : 0);
