import { randomBytes, randomUUID } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { hash } from "bcryptjs";

type AdminUser = Record<string, unknown> & {
  id?: string;
  username?: string;
  email?: string;
  role?: "owner" | "admin" | "demo";
};

loadEnvConfig(process.cwd());

const demoEmail = "demo-cliente@runnersx.example";
const demoUsername = "demo-cliente";

async function readJsonArray(filename: string): Promise<Record<string, unknown>[]> {
  try {
    const parsed: unknown = JSON.parse(await readFile(filename, "utf8"));
    if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "object" || item === null || Array.isArray(item))) {
      throw new Error(`${path.basename(filename)} debe contener una lista de objetos.`);
    }
    return parsed as Record<string, unknown>[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function main() {
  if (
    process.env.VERCEL === "1" ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    throw new Error("La cuenta demo local solo se puede crear sin Vercel ni variables de Supabase.");
  }

  const dataDirectory = path.join(process.cwd(), "data");
  const adminsFile = path.join(dataDirectory, "administradores.json");
  const admins = await readJsonArray(adminsFile);
  const config: unknown = JSON.parse(await readFile(path.join(dataDirectory, "configuracion.json"), "utf8"));
  if (!config || typeof config !== "object" || !("modo_demo" in config) || config.modo_demo !== "true") {
    throw new Error("Activa el modo_demo local en data/configuracion.json antes de crear la cuenta.");
  }

  const demoIndex = admins.findIndex((admin) => admin.email === demoEmail);
  if (demoIndex >= 0 && admins[demoIndex].role === "owner") {
    throw new Error("No se modificó la cuenta existente asociada al correo reservado de demo.");
  }
  if (demoIndex < 0 && admins.length >= 5) {
    throw new Error("No se creó la cuenta: ya se alcanzó el máximo de cinco administradores locales.");
  }

  const usernameTaken = (candidate: string) =>
    admins.some((admin, index) =>
      index !== demoIndex &&
      typeof admin.username === "string" &&
      admin.username.toLowerCase() === candidate.toLowerCase(),
    );
  const username = usernameTaken(demoUsername)
    ? `${demoUsername}-${randomBytes(3).toString("hex")}`
    : demoUsername;
  const password = randomBytes(24).toString("base64url");
  const account: AdminUser = {
    ...(demoIndex >= 0 ? admins[demoIndex] : {}),
    id: demoIndex >= 0 ? String(admins[demoIndex].id ?? randomUUID()) : randomUUID(),
    username,
    email: demoEmail,
    role: "demo",
    password_hash: await hash(password, 12),
  };
  if (demoIndex >= 0) admins[demoIndex] = account;
  else admins.push(account);

  const temporary = `${adminsFile}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(admins, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, adminsFile);

  console.info("Credencial de demostración local (guárdala en un lugar seguro):");
  console.info(`Usuario: ${username}`);
  console.info(`Contraseña: ${password}`);
  console.info("No la publiques ni la reutilices en Vercel o en producción.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "No se pudo preparar el acceso demo local.");
  process.exitCode = 1;
});
