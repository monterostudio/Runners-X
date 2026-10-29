import { randomUUID } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { hash } from "bcryptjs";

type AdminUser = Record<string, unknown> & {
  username?: string;
  password_hash?: string;
};

async function main() {
  const password = process.env.RUNNERSX_RESET_PASSWORD;
  const username = process.env.RUNNERSX_RESET_USERNAME?.trim();
  if (!password || password.length < 12 || Buffer.byteLength(password, "utf8") > 72) {
    throw new Error("La contraseña no cumple los requisitos.");
  }

  const file = path.join(process.cwd(), "data", "administradores.json");
  const users: unknown = JSON.parse(await readFile(file, "utf8"));
  if (!Array.isArray(users) || users.length === 0) {
    throw new Error("No hay cuentas locales que se puedan restablecer.");
  }

  const admins = users as AdminUser[];
  let index = 0;
  if (admins.length > 1) {
    index = admins.findIndex((admin) => admin.username?.toLowerCase() === username?.toLowerCase());
    if (index < 0) throw new Error("No se encontró la cuenta indicada.");
  }

  admins[index].password_hash = await hash(password, 12);
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(admins, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, file);
  console.info("Contraseña local restablecida. Ya puedes iniciar sesión en /admin.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "No se pudo restablecer la contraseña.");
  process.exitCode = 1;
});
