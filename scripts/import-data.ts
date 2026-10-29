import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

const publicCollections = ["carreras", "hero", "galeria", "noticias", "patrocinadores", "resultados"] as const;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error("Configura NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local o el entorno.");
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function readJson<T>(filename: string): Promise<T> {
  return JSON.parse(await readFile(path.join(process.cwd(), "data", filename), "utf8")) as T;
}

async function main() {
  for (const collection of publicCollections) {
    const records = await readJson<Record<string, unknown>[]>(`${collection}.json`);
    const rows = records.map((record, position) => {
      const payload = { ...record };
      delete payload._id;
      return {
        collection,
        item_id: String(record.id ?? `local-${collection}-${position}`),
        position,
        payload,
        updated_at: new Date().toISOString(),
      };
    });
    if (!rows.length) {
      console.info(`${collection}: sin registros`);
      continue;
    }
    const { error } = await supabase.from("content_items").upsert(rows, { onConflict: "collection,item_id" });
    if (error) throw new Error(`No se pudo importar ${collection}: ${error.message}`);
    console.info(`${collection}: ${rows.length} registros importados`);
  }

  const config = await readJson<Record<string, string>>("configuracion.json");
  const { error } = await supabase.from("content_items").upsert({
    collection: "configuracion",
    item_id: "principal",
    position: 0,
    payload: config,
    updated_at: new Date().toISOString(),
  }, { onConflict: "collection,item_id" });
  if (error) throw new Error(`No se pudo importar la configuración: ${error.message}`);
  console.info("Configuración: importada");
  console.info("Por seguridad, no se migraron inscripciones ni cuentas. Configura ADMIN_SETUP_KEY y crea al propietario desde /admin.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Falló la importación de datos.");
  process.exitCode = 1;
});
