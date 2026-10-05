// Banc de test de la base : rejoue toutes les migrations dans un Postgres 17 local (PGlite)
// avec des bouchons de l'environnement Supabase (auth, storage, rôles), puis vérifie les règles du jeu,
// l'anti-triche, la RLS (deux comptes) et l'immuabilité du registre.
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
const A = "aaaaaaaa-0000-4000-8000-000000000001";
const B = "bbbbbbbb-0000-4000-8000-000000000002";
const C = "cccccccc-0000-4000-8000-000000000003";
const D = "dddddddd-0000-4000-8000-000000000004";
const ADMIN = "eeeeeeee-0000-4000-8000-000000000005";
await q(`insert into auth.users (id, email) values
  ($1, 'a@exemple.fr'), ($2, 'b@exemple.fr'), ($3, 'c@exemple.fr'), ($4, 'd@exemple.fr'), ($5, 'admin@exemple.fr')`,
  [A, B, C, D, ADMIN]);
const testCohort = await val("select id from public.cohorts where is_test");
const janCohort = await val("select id from public.cohorts where name = 'Arc du 1er janvier'");
const parisToday = await val("select public.paris_today()::text");

const onboard = (user, overrides = {}) =>
  as(user, () => rpc("create_enrollment", {
    p_pseudo: `joueur_${user.slice(0, 4)}`, p_birth_year: 2000, p_is_public: true, p_adult: true,
    p_category: "etudes", p_goal_title: "Valider mon partiel de droit", p_goal_public: true,
    p_weak_moments: ["fatigue", "commencer"], p_wake_time: "07:00", p_pushups: "oui", p_cohort_id: testCohort,
    ...overrides,
  }));

// Inscription active dans une cohorte démarrée il y a `daysAgo` jours (on recule la date après coup,
// car on ne rejoint pas un arc commencé depuis plus de 6 jours).
async function pastEnrollment(user, daysAgo, name, overrides = {}) {
  const cohort = await val("insert into public.cohorts (name, start_date, is_test) values ($1, public.paris_today(), true) returning id", [name]);
  const enrollment = await onboard(user, { p_cohort_id: cohort, p_weak_moments: [], ...overrides });
  await q("update public.cohorts set start_date = public.paris_today() - $2::int where id = $1", [cohort, daysAgo]);
  await q("update public.enrollments set status = 'active', started_on = public.paris_today() - $2::int, paid_at = now() where id = $1", [enrollment, daysAgo]);
  return { cohort, enrollment };
}

// ---------------------------------------------------------------------------
console.log("\nOnboarding");
await rejects("mineur refusé", () => onboard(A, { p_birth_year: 2012 }), "majeures");
await rejects("sans attestation de majorité", () => onboard(A, { p_adult: false }), "majeures");
await rejects("pseudo invalide", () => onboard(A, { p_pseudo: "A!" }), "Pseudo");
await rejects("heure de lever invalide", () => onboard(A, { p_wake_time: "07:15" }), "Heure");
const enrA = await onboard(A);
check("inscription créée", Boolean(enrA));
const principlesA = await q("select * from public.principles where enrollment_id = $1 order by position", [enrA]);
check("5 principes générés", principlesA.length === 5, JSON.stringify(principlesA.map((p) => p.template_code)));
check("socle : réveil, pompes, bureau", ["reveil", "pompes_20", "bureau_50"].every((c, i) => principlesA[i].template_code === c));
check("moments de décrochage pris en compte", principlesA[3].template_code === "fatigue_25" && principlesA[4].template_code === "petite_action");
check("réveil à l'heure choisie", principlesA[0].if_text === "S'il est 7 h" && principlesA[0].target.before === "07:00");
check("difficulté 3 plafonnée à 2 au niveau 1", principlesA[2].difficulty === 2 && principlesA[2].max_difficulty === 3);
await rejects("pseudo déjà pris", () => onboard(B, { p_pseudo: "joueur_aaaa" }), "déjà pris");
const enrB = await onboard(B, { p_category: "business", p_weak_moments: ["soir"], p_pushups: "non" });
const codesB = (await q("select template_code from public.principles where enrollment_id = $1 order by position", [enrB])).map((r) => r.template_code);
check("business + soir + pas de pompes", JSON.stringify(codesB) === JSON.stringify(["reveil", "squats_20", "bureau_50", "telephone_22h30", "prospection"]), JSON.stringify(codesB));
const enrDefault = await onboard(D, { p_cohort_id: null });
check("sans cohorte précisée : l'arc du 1er janvier, jamais la cohorte de test",
  (await val("select cohort_id from public.enrollments where id = $1", [enrDefault])) === janCohort);

await as(A, () => rpc("set_custom_principle", { p_if: "je rentre chez moi", p_then: "je range mon bureau" }));
const custom = await one("select * from public.principles where enrollment_id = $1 and source = 'custom'", [enrA]);
check("principe perso : difficulté 1, déclaratif", custom.difficulty === 1 && custom.proof_type === "declaratif" && custom.if_text === "Si je rentre chez moi");

// ---------------------------------------------------------------------------
console.log("\nRLS (deux comptes)");
check("A voit ses principes", (await as(A, () => q("select id from public.principles"))).length === 6);
check("B ne voit pas ceux de A", (await as(B, () => q("select id from public.principles where enrollment_id = $1", [enrA]))).length === 0);
check("B ne voit pas le profil de A", (await as(B, () => q("select id from public.profiles where id = $1", [A]))).length === 0);
await rejects("anon ne lit aucun profil", () => as(null, () => q("select id from public.profiles"), { role: "anon" }), "permission denied");
await rejects("anon ne lit pas les inscriptions", () => as(null, () => q("select id from public.enrollments"), { role: "anon" }), "permission denied");
await rejects("un utilisateur n'écrit pas dans validations", () => as(A, () => q(
  "insert into public.validations (enrollment_id, principle_id, day, proof_type, strength, points) values ($1, $2, current_date, 'declaratif', 'forte', 999)",
  [enrA, principlesA[4].id])), "permission denied");
await rejects("un utilisateur ne se rend pas admin", () => as(A, () => q("update public.profiles set is_admin = true where id = $1", [A])), "permission denied");
await rejects("le nonce d'une session n'est pas lisible", () => as(A, () => q("select nonce from public.proof_sessions")), "permission denied");

// ---------------------------------------------------------------------------
console.log("\nPaiement");
check("sans prévente : rien à rattacher", (await as(A, () => rpc("claim_presale"))) === false);
await q("insert into public.presales (cohort_id, email, stripe_checkout_session_id, amount_paid_cents) values ($1, 'a@exemple.fr', 'cs_test_A', 1500)", [testCohort]);
check("prévente rattachée", (await as(A, () => rpc("claim_presale"))) === true);
const activeA = await one("select * from public.enrollments where id = $1", [enrA]);
check("inscription active dès aujourd'hui", activeA.status === "active" && activeA.started_on.toISOString().slice(0, 10) === parisToday);
await rejects("principes figés une fois l'arc commencé", () => as(A, () => rpc("remove_custom_principle")), "ne se modifient plus");
const activation = await rpc("activate_paid_enrollment", {
  p_enrollment: enrB, p_session_id: "cs_test_B", p_amount: 1900, p_promotion_code_id: null, p_utm_source: "tiktok", p_utm_campaign: "x",
});
check("webhook : pass payé activé", activation.activated === true);
check("webhook rejoué : pas de seconde activation", (await rpc("activate_paid_enrollment", {
  p_enrollment: enrB, p_session_id: "cs_test_B", p_amount: 1900, p_promotion_code_id: null, p_utm_source: null, p_utm_campaign: null,
})).activated === false);
await rejects("un utilisateur ne peut pas s'activer lui-même", () => as(D, () => rpc("activate_paid_enrollment", {
  p_enrollment: enrDefault, p_session_id: "x", p_amount: 0, p_promotion_code_id: null, p_utm_source: null, p_utm_campaign: null,
})), "permission denied");

// ---------------------------------------------------------------------------
console.log("\nValidations déclaratives et anti-triche");
await q("update public.settings set value = '0' where key = 'audit_rate'");
const petite = principlesA[4];
const res1 = await as(A, () => rpc("validate_declaratif", { p_principle_id: petite.id }));
check("preuve faible : 50 % des points", res1.points === 5, JSON.stringify(res1));
await rejects("deux fois le même jour", () => as(A, () => rpc("validate_declaratif", { p_principle_id: petite.id })), "Déjà validé");
await rejects("pour un autre utilisateur", () => as(B, () => rpc("validate_declaratif", { p_principle_id: principlesA[3].id })), "introuvable");
await rejects("sans la bonne preuve", () => as(A, () => rpc("validate_declaratif", { p_principle_id: principlesA[2].id })), "autre preuve");
await rejects("sans être connecté", () => as(null, () => rpc("validate_declaratif", { p_principle_id: petite.id }), { role: "anon" }), "permission denied");
const reps = await as(A, () => rpc("validate_declaratif", { p_principle_id: principlesA[1].id }));
check("pompes sans caméra : repli déclaratif à 50 %", reps.points === 10);

// ---------------------------------------------------------------------------
console.log("\nRegistre des points (ajout seul)");
await rejects("authenticated ne modifie pas le registre", () => as(A, () => q("update public.points_ledger set delta = 1000")), "permission denied");
await rejects("authenticated ne supprime pas", () => as(A, () => q("delete from public.points_ledger")), "permission denied");
await rejects("authenticated n'insère pas", () => as(A, () => q(
  "insert into public.points_ledger (enrollment_id, user_id, day, delta, reason, ref_id) values ($1, $2, current_date, 999, 'validation', gen_random_uuid())", [enrA, A])), "permission denied");
await rejects("service_role ne modifie pas non plus", () => as(null, () => q("update public.points_ledger set delta = 1000"), { role: "service_role" }), "permission denied");
await rejects("même le propriétaire ne peut pas modifier (trigger)", () => q("update public.points_ledger set delta = 1000"), "ajout seul");
await rejects("ni vider la table", () => q("truncate public.points_ledger"), "ajout seul");
await rejects("une validation est définitive", () => q("update public.validations set points = 99"), "définitive");

// ---------------------------------------------------------------------------
console.log("\nLiens");
const enrE = enrB;
const pubPrinciple = await one("insert into public.principles (enrollment_id, position, if_text, then_text, proof_type, difficulty, max_difficulty, days, target, source) values ($1, 7, 'Si c''est un jour', 'alors je publie.', 'lien', 2, 2, '{1,2,3,4,5,6,7}', '{\"domains\":[\"tiktok.com\",\"youtube.com\"]}', 'template') returning *", [enrE]);
await rejects("domaine non autorisé", () => as(B, () => rpc("validate_link", { p_principle_id: pubPrinciple.id, p_url: "https://evil.com/x" })), "doit venir de");
await rejects("http refusé", () => as(B, () => rpc("validate_link", { p_principle_id: pubPrinciple.id, p_url: "http://tiktok.com/@a/video/1" })), "https");
await rejects("lien vers le site, pas une publication", () => as(B, () => rpc("validate_link", { p_principle_id: pubPrinciple.id, p_url: "https://www.tiktok.com/" })), "publication");
await rejects("identifiants dans l'URL refusés", () => as(B, () => rpc("validate_link", { p_principle_id: pubPrinciple.id, p_url: "https://tiktok.com@evil.com/x" })), "invalide");
const link1 = await as(B, () => rpc("validate_link", { p_principle_id: pubPrinciple.id, p_url: "https://www.TikTok.com/@nonante/video/123/#top" }));
check("lien valide : 50 %", link1.points === 10);
check("lien normalisé", (await val("select link_url from public.validations where id = $1", [link1.validation_id])) === "https://www.tiktok.com/@nonante/video/123");

// ---------------------------------------------------------------------------
console.log("\nMinuteur de concentration");
const bureau = principlesA[2];
const s1 = await as(A, () => rpc("start_proof_session", { p_principle_id: bureau.id }));
check("session créée avec nonce", s1.nonce?.length === 64 && s1.minutes === 50);
await rejects("une seule session à la fois", () => as(A, () => rpc("start_proof_session", { p_principle_id: principlesA[3].id })), "déjà en cours");
await rejects("mauvais nonce", () => as(A, () => rpc("heartbeat", { p_session_id: s1.id, p_nonce: "x", p_visible: true, p_hidden_ms: 0 })), "introuvable");
const hb = await as(A, () => rpc("heartbeat", { p_session_id: s1.id, p_nonce: s1.nonce, p_visible: true, p_hidden_ms: 0 }));
check("battement compté", hb.status === "running" && hb.heartbeats === 1);
const hb2 = await as(A, () => rpc("heartbeat", { p_session_id: s1.id, p_nonce: s1.nonce, p_visible: true, p_hidden_ms: 0 }));
check("battements trop rapprochés ignorés", hb2.heartbeats === 1);
await rejects("finir avant l'heure", () => as(A, () => rpc("complete_session", { p_session_id: s1.id, p_nonce: s1.nonce })), "pas terminée");
await q("update public.proof_sessions set started_at = now() - interval '51 minutes', heartbeats = 150, last_heartbeat_at = now() - interval '5 seconds' where id = $1", [s1.id]);
const broken = await as(A, () => rpc("complete_session", { p_session_id: s1.id, p_nonce: s1.nonce }));
check("moins de 90 % des battements : session cassée", broken.status === "broken");
check("session cassée : − 5", (await val("select delta from public.points_ledger where reason = 'session_broken' and ref_id = $1", [s1.id])) === -5);
const s2 = await as(A, () => rpc("start_proof_session", { p_principle_id: bureau.id }));
await q("update public.proof_sessions set started_at = now() - interval '50 minutes 5 seconds', heartbeats = 200, last_heartbeat_at = now() - interval '5 seconds' where id = $1", [s2.id]);
const done = await as(A, () => rpc("complete_session", { p_session_id: s2.id, p_nonce: s2.nonce }));
check("session complète : preuve forte, 100 %", done.status === "completed" && done.validation.points === 20, JSON.stringify(done));
const s3 = await as(A, () => rpc("start_proof_session", { p_principle_id: principlesA[3].id }));
const hidden = await as(A, () => rpc("heartbeat", { p_session_id: s3.id, p_nonce: s3.nonce, p_visible: true, p_hidden_ms: 11000 }));
check("11 s hors de l'écran : session cassée", hidden.status === "broken");
const s4 = await as(A, () => rpc("start_proof_session", { p_principle_id: principlesA[3].id }));
await q("update public.proof_sessions set last_heartbeat_at = now() - interval '50 seconds' where id = $1", [s4.id]);
const gap = await as(A, () => rpc("heartbeat", { p_session_id: s4.id, p_nonce: s4.nonce, p_visible: true, p_hidden_ms: 0 }));
check("plus de 45 s sans battement : session cassée", gap.status === "broken");
const s5 = await as(A, () => rpc("start_proof_session", { p_principle_id: principlesA[3].id }));
const ab = await as(A, () => rpc("abandon_session", { p_session_id: s5.id, p_nonce: s5.nonce }));
check("abandon : − 5", ab.status === "abandoned" && (await val("select delta from public.points_ledger where reason = 'session_broken' and ref_id = $1", [s5.id])) === -5);
// Session commencée avant-hier : trop tard.
const s6 = await as(A, () => rpc("start_proof_session", { p_principle_id: principlesA[3].id }));
await q("update public.proof_sessions set day = public.paris_today() - 2, started_at = now() - interval '26 minutes', heartbeats = 100, last_heartbeat_at = now() where id = $1", [s6.id]);
await rejects("pas de validation rétroactive", () => as(A, () => rpc("complete_session", { p_session_id: s6.id, p_nonce: s6.nonce })), "");

// ---------------------------------------------------------------------------
console.log("\nRépétitions");
const enrC = await onboard(C, { p_weak_moments: [] });
await rpc("activate_paid_enrollment", { p_enrollment: enrC, p_session_id: "cs_test_C", p_amount: 1900, p_promotion_code_id: null, p_utm_source: null, p_utm_campaign: null });
const pompesC = await one("select * from public.principles where enrollment_id = $1 and template_code = 'pompes_20'", [enrC]);
const r1 = await as(C, () => rpc("start_proof_session", { p_principle_id: pompesC.id }));
await q("update public.proof_sessions set started_at = now() - interval '90 seconds' where id = $1", [r1.id]);
const fast = Array.from({ length: 20 }, (_, i) => [i * 1000, i * 1000 + 500]);
const rFast = await as(C, () => rpc("complete_reps", { p_session_id: r1.id, p_nonce: r1.nonce, p_reps: JSON.stringify(fast) }));
check("répétition de moins de 0,8 s refusée", rFast.status === "rejected", JSON.stringify(rFast));
const r2 = await as(C, () => rpc("start_proof_session", { p_principle_id: pompesC.id }));
await q("update public.proof_sessions set started_at = now() - interval '90 seconds' where id = $1", [r2.id]);
const few = Array.from({ length: 12 }, (_, i) => [i * 2000, i * 2000 + 1200]);
const rFew = await as(C, () => rpc("complete_reps", { p_session_id: r2.id, p_nonce: r2.nonce, p_reps: JSON.stringify(few) }));
check("objectif non atteint refusé", rFew.status === "rejected" && rFew.reason.includes("12 sur 20"));
const r3 = await as(C, () => rpc("start_proof_session", { p_principle_id: pompesC.id }));
const future = Array.from({ length: 20 }, (_, i) => [i * 2000, i * 2000 + 1200]);
const rFuture = await as(C, () => rpc("complete_reps", { p_session_id: r3.id, p_nonce: r3.nonce, p_reps: JSON.stringify(future) }));
check("répétitions plus longues que la session refusées", rFuture.status === "rejected");
const r4 = await as(C, () => rpc("start_proof_session", { p_principle_id: pompesC.id }));
await q("update public.proof_sessions set started_at = now() - interval '60 seconds' where id = $1", [r4.id]);
const good = Array.from({ length: 20 }, (_, i) => [i * 2000, i * 2000 + 1500]);
const rGood = await as(C, () => rpc("complete_reps", { p_session_id: r4.id, p_nonce: r4.nonce, p_reps: JSON.stringify(good) }));
check("20 pompes valides : preuve forte", rGood.status === "completed" && rGood.validation.points === 20, JSON.stringify(rGood));

// ---------------------------------------------------------------------------
console.log("\nRéveil");
const reveilC = await one("select * from public.principles where enrollment_id = $1 and template_code = 'reveil'", [enrC]);
await q("update public.principles set target = jsonb_build_object('before', to_char(public.paris_now() + interval '1 hour', 'HH24:MI')) where id = $1", [reveilC.id]);
const nearMidnight = await val("select public.paris_now()::time > '22:59'");
if (nearMidnight) {
  console.log("  (test du réveil sauté : trop près de minuit)");
} else {
  const w = await as(C, () => rpc("start_proof_session", { p_principle_id: reveilC.id }));
  check("code à 6 chiffres affiché", /^\d{6}$/.test(w.code));
  const wrong = await as(C, () => rpc("complete_wake_check", { p_session_id: w.id, p_nonce: w.nonce, p_code: w.code === "000000" ? "111111" : "000000" }));
  check("mauvais code refusé", wrong.status === "running" && wrong.error === "Code incorrect.");
  const ok = await as(C, () => rpc("complete_wake_check", { p_session_id: w.id, p_nonce: w.nonce, p_code: w.code }));
  check("bon code : preuve forte", ok.status === "completed" && ok.validation.points === 20, JSON.stringify(ok));
}
await q("update public.principles set target = jsonb_build_object('before', to_char(public.paris_now() + interval '3 hours', 'HH24:MI')) where id = $1", [reveilC.id]);
if (!(await val("select (public.paris_now() + interval '3 hours')::date <> public.paris_today()"))) {
  await rejects("réveil trop tôt (fenêtre de 2 h 30)", () => as(B, async () => {
    const reveilB = await one("select id from public.principles where enrollment_id = $1 and template_code = 'reveil'", [enrB]);
    await db.exec("reset role");
    await q("update public.principles set target = jsonb_build_object('before', to_char(public.paris_now() + interval '3 hours', 'HH24:MI')) where id = $1", [reveilB.id]);
    await db.exec("set role authenticated");
    return rpc("start_proof_session", { p_principle_id: reveilB.id });
  }), "se prouve entre");
}

// ---------------------------------------------------------------------------
console.log("\nContrôles");
await q("update public.settings set value = '1' where key = 'audit_rate'");
const tdC = await one("insert into public.principles (enrollment_id, position, if_text, then_text, proof_type, difficulty, max_difficulty, days, target, source) values ($1, 8, 'Si test', 'alors test.', 'declaratif', 2, 2, '{1,2,3,4,5,6,7}', '{}', 'template') returning *", [enrC]);
const audited = await as(C, () => rpc("validate_declaratif", { p_principle_id: tdC.id }));
check("contrôle déclenché", audited.audit === true);
const audit = await one("select * from public.audits where validation_id = $1", [audited.validation_id]);
check("délai de 24 h", Math.abs(new Date(audit.due_at) - Date.now() - 86400000) < 60000);
await q("update public.audits set due_at = now() - interval '1 minute' where id = $1", [audit.id]);
check("contrôle expiré traité", (await rpc("cron_expire_audits")) === 1);
check("pénalité − 3 × valeur", (await val("select delta from public.points_ledger where reason = 'audit_failed' and ref_id = $1", [audit.id])) === -60);
check("preuves refusées +1", (await val("select refused_proofs from public.profiles where id = $1", [C])) === 1);
check("validation rejetée", (await val("select status from public.validations where id = $1", [audited.validation_id])) === "rejected");
await q("update public.settings set value = '0' where key = 'audit_rate'");

// ---------------------------------------------------------------------------
console.log("\nClôture des jours");
// Cohorte qui a démarré il y a 10 jours, joueur entré le premier jour.
const { enrollment: enrPast } = await pastEnrollment(D, 10, "Passée");
const pPast = await q("select * from public.principles where enrollment_id = $1 order by position", [enrPast]);
const scheduled = (p, offset) => q("select public._is_scheduled($1, public.paris_today() - $2::int) s", [p.days, offset]).then((r) => r[0].s);
// J-10 : tout validé. J-9 : app ouverte, rien validé. J-8 : jour blanc. J-7 à J-1 : tout validé.
for (const offset of [10, 7, 6, 5, 4, 3, 2, 1]) {
  for (const p of pPast) {
    if (await scheduled(p, offset)) {
      await q("insert into public.validations (enrollment_id, principle_id, day, proof_type, strength, points) values ($1, $2, public.paris_today() - $3::int, 'declaratif', 'faible', 0)", [enrPast, p.id, offset]);
    }
  }
}
await q("insert into public.app_opens (enrollment_id, day) values ($1, public.paris_today() - 9)", [enrPast]);
const closed = await rpc("cron_close_days");
check("10 jours clôturés", closed >= 10, String(closed));
const statuses = (await q("select status from public.day_status where enrollment_id = $1 order by day", [enrPast])).map((r) => r.status);
check("vert, rouge, blanc, puis vert", statuses.slice(0, 4).join(",") === "green,red,white,green", statuses.join(","));
const miss9 = await one("select * from public.misses where enrollment_id = $1 and day = public.paris_today() - 9 and principle_id = $2", [enrPast, pPast[0].id]);
const miss8 = await one("select * from public.misses where enrollment_id = $1 and day = public.paris_today() - 8 and principle_id = $2", [enrPast, pPast[0].id]);
check("raté : − valeur", miss9.points === -20 && miss9.streak === 1, JSON.stringify(miss9));
check("raté deux jours d'affilée et jour blanc : − 2 × valeur", miss8.points === -40 && miss8.streak === 2 && miss8.white, JSON.stringify(miss8));
check("idempotent : rien de plus au second passage", (await rpc("cron_close_days")) === 0);
check("premier vert débloqué", Boolean(await val("select 1 from public.user_achievements ua join public.achievements a on a.id = ua.achievement_id where a.code = 'premier_vert' and ua.enrollment_id = $1", [enrPast])));

// Trois jours d'affilée : − 3 ×.
await q("insert into auth.users (id, email) values ('ffffffff-0000-4000-8000-000000000006', 'f@exemple.fr')");
const F = "ffffffff-0000-4000-8000-000000000006";
const { enrollment: enrF } = await pastEnrollment(F, 4, "Passée 2");
for (const offset of [4, 3, 2, 1]) await q("insert into public.app_opens values ($1, public.paris_today() - $2::int)", [enrF, offset]);
await rpc("cron_close_days");
const reveilF = await val("select id from public.principles where enrollment_id = $1 and template_code = 'reveil'", [enrF]);
const streakPoints = (await q("select points from public.misses where principle_id = $1 order by day", [reveilF])).map((r) => r.points);
check("− 1 ×, − 2 ×, − 3 ×, − 3 ×", streakPoints.join(",") === "-20,-40,-60,-60", streakPoints.join(","));

// Abandon : 7 jours blancs d'affilée.
await q("insert into auth.users (id, email) values ('99999999-0000-4000-8000-000000000007', 'g@exemple.fr')");
const G = "99999999-0000-4000-8000-000000000007";
const { enrollment: enrG } = await pastEnrollment(G, 8, "Passée 3");
await rpc("cron_close_days");
check("7 jours blancs : abandon", (await val("select status from public.enrollments where id = $1", [enrG])) === "abandoned");

// ---------------------------------------------------------------------------
console.log("\nClassement et statistiques honnêtes");
const board = await as(null, () => q("select * from public.leaderboard($1, null, 'arc')", [testCohort]), { role: "anon" });
const sumA = Number(await val("select coalesce(sum(delta), 0) from public.points_ledger where enrollment_id = $1", [enrA]));
check("points du classement = somme du registre", board.find((r) => r.pseudo === "joueur_aaaa")?.points === sumA, JSON.stringify(board));
const stats = await as(null, () => one("select * from public.cohort_stats($1)", [testCohort]), { role: "anon" });
const realPaid = Number(await val("select count(*) from public.enrollments where cohort_id = $1 and status <> 'pending_payment'", [testCohort]));
check("inscrits = vrai nombre en base", stats.inscrits === realPaid, JSON.stringify(stats));
check("la landing affiche le même chiffre", (await as(null, () => rpc("cohort_signups", { p_cohort_id: testCohort }), { role: "anon" })) === stats.inscrits);
const privateProfile = await as(null, () => rpc("public_profile", { p_pseudo: "joueur_aaaa" }), { role: "anon" });
check("profil public lisible", privateProfile?.pseudo === "joueur_aaaa" && !("email" in privateProfile));
await q("update public.profiles set is_public = false where id = $1", [A]);
check("profil privé invisible", (await as(null, () => rpc("public_profile", { p_pseudo: "joueur_aaaa" }), { role: "anon" })) === null);
check("pseudo masqué au classement", (await as(null, () => q("select pseudo from public.leaderboard($1, null, 'arc')", [testCohort]), { role: "anon" })).some((r) => r.pseudo === "Anonyme"));

// ---------------------------------------------------------------------------
console.log("\nTableau de bord et épreuves");
const dash = await as(C, () => rpc("my_dashboard"));
check("tableau de bord : jour 1", dash.state === "running" && dash.day_number === 1, JSON.stringify({ state: dash.state, day: dash.day_number }));
check("calendrier de 90 jours", dash.calendar.length === 90 && dash.calendar[0].status === "today");
check("épreuve de la semaine attribuée", Boolean(dash.challenge?.assignment_id), JSON.stringify(dash.challenge));
check("ouverture de l'app notée", Boolean(await val("select 1 from public.app_opens where enrollment_id = $1 and day = public.paris_today()", [enrC])));
const assignment = await one("select a.*, ch.proof_type, ch.code from public.challenge_assignments a join public.challenges ch on ch.id = a.challenge_id where a.enrollment_id = $1", [enrC]);
const declChallenge = await val("select id from public.challenges where code = 'business_n1_trois'");
await q("update public.challenge_assignments set challenge_id = $1 where id = $2", [declChallenge, assignment.id]);
const ch1 = await as(C, () => rpc("validate_challenge_declaratif", { p_assignment_id: assignment.id }));
check("épreuve déclarative réussie : + 100", ch1.status === "done" && (await val("select delta from public.points_ledger where reason = 'challenge' and ref_id = $1", [assignment.id])) === 100);
await rejects("épreuve déjà jugée", () => as(C, () => rpc("validate_challenge_declaratif", { p_assignment_id: assignment.id })), "déjà jugée");

// ---------------------------------------------------------------------------
console.log("\nAdmin et double authentification");
await q("insert into public.profiles (id, pseudo, birth_year, is_admin) values ($1, 'admin', 1990, true)", [ADMIN]);
await rejects("sans aal2 : refusé", () => as(ADMIN, () => rpc("admin_overview")), "Double authentification");
await rejects("non admin : refusé", () => as(A, () => rpc("admin_overview"), { aal: "aal2" }), "réservé");
const overview = await as(ADMIN, () => rpc("admin_overview"), { aal: "aal2" });
check("admin avec aal2 : vue d'ensemble", Array.isArray(overview.cohorts) && overview.cohorts.length >= 2);
await as(ADMIN, () => rpc("admin_save_cohort", { p_id: janCohort, p_name: "Arc du 1er janvier", p_start_date: "2027-01-01", p_enroll_open: true, p_price_cents: 2500, p_early_price_cents: 1500, p_is_test: false }), { aal: "aal2" });
check("prix modifié sans redéployer", (await val("select price_cents from public.cohorts where id = $1", [janCohort])) === 2500);
check("action journalisée", Number(await val("select count(*) from public.audit_log where action = 'cohort_update'")) === 1);

// ---------------------------------------------------------------------------
console.log("\nFin d'arc");
const endCohort = await val("insert into public.cohorts (name, start_date, is_test) values ('Finie', public.paris_today() - 90, true) returning id");
await q("insert into auth.users (id, email) values ('12121212-0000-4000-8000-000000000008', 'h@exemple.fr')");
const H = "12121212-0000-4000-8000-000000000008";
await q("insert into public.profiles (id, pseudo, birth_year) values ($1, 'tenace', 2000)", [H]);
const enrHid = await val("insert into public.enrollments (user_id, cohort_id, category, goal_title, status, started_on, paid_at) values ($1, $2, 'etudes', 'Tenir', 'active', public.paris_today() - 90, now()) returning id", [H, endCohort]);
await q("insert into public.day_status (enrollment_id, day, status, opened_app) select $1, d::date, case when extract(day from d) = 1 then 'red' else 'green' end, true from generate_series(public.paris_today() - 90, public.paris_today() - 1, interval '1 day') d", [enrHid]);
const ending = await rpc("cron_cohort_end");
check("arc tenu", (await val("select status from public.enrollments where id = $1", [enrHid])) === "completed", JSON.stringify(ending));
check("+ 500 une seule fois", (await val("select sum(delta) from public.points_ledger where reason = 'arc_completed' and enrollment_id = $1", [enrHid])) == 500);
check("rendu pour le code fidélité", ending.completed.some((x) => x.enrollment_id === enrHid));
check("cohorte close une seule fois", (await rpc("cron_cohort_end")).completed.length === 0);

// ---------------------------------------------------------------------------
console.log("\nSuppression de compte (RGPD)");
const paths = await as(C, () => rpc("delete_my_account"));
check("compte supprimé", Array.isArray(paths) && !(await val("select 1 from public.profiles where id = $1", [C])));
check("ses points aussi", Number(await val("select count(*) from public.points_ledger where user_id = $1", [C])) === 0);
await rejects("le drapeau ne fuit pas hors de la transaction", () => q("delete from public.points_ledger"), "ajout seul");

console.log(`\n${passed} réussis, ${failed} échoués.`);
process.exit(failed ? 1 : 0);
