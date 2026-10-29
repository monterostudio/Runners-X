import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin } from "@/lib/admin-auth";
import { getAdmins, saveAdminUser } from "@/lib/data";

const setupSchema = z.object({
  setupKey: z.string().min(1).max(256),
  username: z.string().trim().min(3).max(32).regex(/^[A-Za-z0-9._-]+$/),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128),
});

export async function POST(request: Request) {
  try {
    await assertSameOrigin();
    const input = setupSchema.parse(await request.json());
    const expectedKey = process.env.ADMIN_SETUP_KEY;
    if (!expectedKey || input.setupKey !== expectedKey) {
      return NextResponse.json({ error: "La clave de instalación no es correcta." }, { status: 403 });
    }
    if ((await getAdmins()).length > 0) {
      return NextResponse.json({ error: "Ya existe una cuenta de administrador." }, { status: 409 });
    }
    await saveAdminUser({
      username: input.username,
      email: input.email,
      role: "owner",
      password_hash: await hash(input.password, 12),
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear el propietario.";
    const status = error instanceof z.ZodError ? 400 : message.includes("origen válido") || message.includes("otro origen") ? 403 : 500;
    return NextResponse.json({ error: status === 500 ? "No se pudo crear el propietario." : message }, { status });
  }
}
