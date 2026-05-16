// One-shot helper: POST SQL to Supabase Management API.
// Usage: SUPABASE_PAT=... SUPABASE_PROJECT_REF=... node scripts/run-sql.mjs path/to/file.sql
import { readFileSync } from "node:fs";
import { argv, env, exit } from "node:process";

const pat = env.SUPABASE_PAT;
const ref = env.SUPABASE_PROJECT_REF;
const file = argv[2];
if (!pat || !ref || !file) {
  console.error("Missing SUPABASE_PAT / SUPABASE_PROJECT_REF / file arg");
  exit(1);
}

const sql = readFileSync(file, "utf8");
const res = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${pat}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  }
);

const text = await res.text();
if (!res.ok) {
  console.error(`❌ HTTP ${res.status}`);
  console.error(text);
  exit(1);
}
console.log("✅ OK");
console.log(text);
