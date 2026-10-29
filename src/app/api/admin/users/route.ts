import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, requireAdmin } from "@/lib/admin-auth";
import { deleteAdminUser, getAdmins, saveAdminUser } from "@/lib/data";

const userSchema = z.object({
  action: z.enum(["create", "update", "delete"]),
  id: z.string().optional(),
  username: z.string().trim().min(3).max(32).regex(/^[A-Za-z0-9._-]+$/).optional(),
  email: z.string().trim().email().max(254).optional(),
  password: z.string().min(12).max(128).optional(),
});

export async function GET() {
  try {
    const session = await requireAdmin();
    if (session.role !== "owner") return NextResponse.json({ error: "Acceso reservado al propietario." }, { status: 403 });
    const users = await getAdmins();
    return NextResponse.json(users.map((user) => {
      const safeUser = { ...user };
      delete safeUser.password_hash;
      return safeUser;
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudieron leer los administradores.";
    return NextResponse.json({ error: message === "UNAUTHORIZED" ? "Inicia sesión." : message }, { status: message === "UNAUTHORIZED" ? 401 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    await assertSameOrigin();
    const session = await requireAdmin();
    if (session.role !== "owner") return NextResponse.json({ error: "Solo el propietario puede gestionar administradores." }, { status: 403 });
    const input = userSchema.parse(await request.json());

    if (input.action === "delete") {
      if (!input.id || input.id === session.id) return NextResponse.json({ error: "No puedes eliminar tu propia cuenta." }, { status: 400 });
      await deleteAdminUser(input.id);
      return NextResponse.json({ success: true });
    }
    if (!input.username || !input.email) return NextResponse.json({ error: "Completa el usuario y el correo." }, { status: 400 });

    const users = await getAdmins();
    const current = input.id ? users.find((user) => user._id === input.id) : undefined;
    if (input.action === "update" && !current) return NextResponse.json({ error: "No se encontró el administrador." }, { status: 404 });
    if (input.action === "create" && users.length >= 5) return NextResponse.json({ error: "El máximo es cinco cuentas de administrador." }, { status: 400 });
    const password_hash = input.password ? await hash(input.password, 12) : undefined;
    if (input.action === "create" && !password_hash) return NextResponse.json({ error: "La contraseña debe tener al menos 12 caracteres." }, { status: 400 });
    await saveAdminUser({
      id: input.id,
      username: input.username,
      email: input.email,
      role: current?.role === "owner" ? "owner" : "admin",
      ...(password_hash ? { password_hash } : {}),
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo guardar el administrador.";
    const status = message === "UNAUTHORIZED" ? 401 : error instanceof z.ZodError ? 400 : 400;
    return NextResponse.json({ error: message === "UNAUTHORIZED" ? "Inicia sesión." : message }, { status });
  }
}
