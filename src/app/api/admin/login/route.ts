import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, createAdminSession, verifyCredentials } from "@/lib/admin-auth";

const credentialsSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(256),
});

export async function POST(request: Request) {
  try {
    await assertSameOrigin();
    const input = credentialsSchema.parse(await request.json());
    const user = await verifyCredentials(input.username, input.password);
    if (!user) return NextResponse.json({ error: "El usuario o la contraseña no son correctos." }, { status: 401 });
    await createAdminSession(user);
    return NextResponse.json({ user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo iniciar sesión.";
    const status = error instanceof z.ZodError ? 400 : message === "La solicitud no tiene un origen válido." || message === "La solicitud proviene de otro origen." ? 403 : 500;
    return NextResponse.json({ error: status === 500 ? "No se pudo validar el acceso." : message }, { status });
  }
}
