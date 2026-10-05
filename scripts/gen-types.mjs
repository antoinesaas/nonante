// Génère lib/database.types.ts à partir des migrations, au format de `supabase gen types typescript`.
// Sans Docker ni connexion : les migrations sont rejouées dans un Postgres local (PGlite).
// Usage : npm run db:types
import { PGlite } from "@electric-sql/pglite";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { bootstrap } from "./lib/pglite-supabase.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const db = new PGlite();
await bootstrap(db, root);
const rows = async (sql) => (await db.query(sql)).rows;

const SCALARS = {
  uuid: "string", text: "string", varchar: "string", bpchar: "string", date: "string", time: "string",
  timestamp: "string", timestamptz: "string", interval: "string", int2: "number", int4: "number",
  int8: "number", numeric: "number", float4: "number", float8: "number", bool: "boolean", json: "Json",
  jsonb: "Json", void: "undefined",
};
const ts = (udt) => (udt.startsWith("_") ? `${SCALARS[udt.slice(1)] ?? "unknown"}[]` : SCALARS[udt] ?? "unknown");

// Tables exposées (schéma public).
const columns = await rows(`
  select c.table_name, c.column_name, c.udt_name, c.is_nullable = 'YES' as nullable,
    c.column_default is not null or c.is_identity = 'YES' as has_default, c.is_generated = 'ALWAYS' as generated
  from information_schema.columns c
  join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
  where c.table_schema = 'public' and t.table_type = 'BASE TABLE'
  order by c.table_name, c.column_name`);
const tables = {};
for (const col of columns) (tables[col.table_name] ??= []).push(col);

// Fonctions appelables par un client (droits accordés à anon, authenticated ou service_role).
const functions = await rows(`
  select p.proname as name,
    coalesce(p.proargnames, '{}') as arg_names,
    coalesce(p.proargmodes::text[], '{}') as arg_modes,
    array(select t.typname from unnest(coalesce(p.proallargtypes, p.proargtypes::oid[])) with ordinality as a(oid, ord)
      join pg_type t on t.oid = a.oid order by a.ord) as arg_udts,
    p.pronargdefaults as n_defaults, p.pronargs as n_in, p.proretset as returns_set,
    rt.typname as return_udt
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_type rt on rt.oid = p.prorettype
  where n.nspname = 'public' and p.proname not like '\\_%'
    and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute')
      or has_function_privilege('service_role', p.oid, 'execute'))
    and p.prokind = 'f' and rt.typname <> 'trigger'
  order by p.proname`);

const out = [];
out.push("// Généré par scripts/gen-types.mjs à partir des migrations. Ne pas modifier à la main.", "");
out.push("export type Json =", "  | string", "  | number", "  | boolean", "  | null", "  | { [key: string]: Json | undefined }", "  | Json[];", "");
out.push("export type Database = {", '  __InternalSupabase: { PostgrestVersion: "13.0.5" };', "  public: {", "    Tables: {");
for (const [name, cols] of Object.entries(tables)) {
  out.push(`      ${name}: {`);
  out.push("        Row: {");
  for (const c of cols) out.push(`          ${c.column_name}: ${ts(c.udt_name)}${c.nullable ? " | null" : ""};`);
  out.push("        };", "        Insert: {");
  for (const c of cols) {
    if (c.generated) out.push(`          ${c.column_name}?: never;`);
    else out.push(`          ${c.column_name}${c.nullable || c.has_default ? "?" : ""}: ${ts(c.udt_name)}${c.nullable ? " | null" : ""};`);
  }
  out.push("        };", "        Update: {");
  for (const c of cols) {
    if (c.generated) out.push(`          ${c.column_name}?: never;`);
    else out.push(`          ${c.column_name}?: ${ts(c.udt_name)}${c.nullable ? " | null" : ""};`);
  }
  out.push("        };", "        Relationships: [];", "      };");
}
out.push("    };", "    Views: { [_ in never]: never };", "    Functions: {");
for (const f of functions) {
  const modes = f.arg_modes.length ? f.arg_modes : f.arg_udts.map(() => "i");
  const inArgs = [];
  const outCols = [];
  f.arg_udts.forEach((udt, i) => {
    const mode = modes[i];
    if (mode === "i" || mode === "b") inArgs.push({ name: f.arg_names[i], udt });
    if (mode === "t" || mode === "o" || mode === "b") outCols.push({ name: f.arg_names[i], udt });
  });
  const firstDefault = inArgs.length - f.n_defaults;
  const args = inArgs.length
    ? `{ ${inArgs.map((a, i) => `${a.name}${i >= firstDefault ? "?" : ""}: ${ts(a.udt)} | null`).join("; ")} }`
    : "never";
  let returns;
  if (outCols.length) {
    returns = `{ ${outCols.map((c) => `${c.name}: ${ts(c.udt)}`).join("; ")} }[]`;
  } else {
    returns = ts(f.return_udt) + (f.returns_set ? "[]" : "");
  }
  out.push(`      ${f.name}: { Args: ${args}; Returns: ${returns} };`);
}
out.push("    };", "    Enums: { [_ in never]: never };", "    CompositeTypes: { [_ in never]: never };", "  };", "};", "");

writeFileSync(join(root, "lib/database.types.ts"), out.join("\n"));
console.log(`lib/database.types.ts : ${Object.keys(tables).length} tables, ${functions.length} fonctions.`);
