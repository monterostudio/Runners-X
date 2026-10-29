import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, requireAdmin } from "@/lib/admin-auth";
import { deleteRegistration, getRegistrations, updateRegistration } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/supabase-admin";

const mutationSchema = z.object({
  action: z.enum(["update", "delete"]),
  id: z.string().min(1),
  estado: z.enum(["Pendiente", "Confirmado"]).optional(),
});

export async function GET() {
  try {
    const session = await requireAdmin();
    if (session.role === "demo" && isSupabaseConfigured()) {
      return NextResponse.json({ error: "La cuenta demo solo puede usarse con datos locales." }, { status: 403 });
    }
    return NextResponse.json(await getRegistrations());
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudieron leer las inscripciones.";
    return NextResponse.json({ error: message === "UNAUTHORIZED" ? "Inicia sesión para continuar." : message }, {
      status: message === "UNAUTHORIZED" ? 401 : 500,
    });
  }
}

export async function POST(request: Request) {
  try {
    await assertSameOrigin();
    const session = await requireAdmin();
    if (session.role === "demo" && isSupabaseConfigured()) {
      return NextResponse.json({ error: "La cuenta demo solo puede usarse con datos locales." }, { status: 403 });
    }
    const input = mutationSchema.parse(await request.json());
    if (input.action === "delete") await deleteRegistration(input.id);
    else if (input.estado) await updateRegistration(input.id, { estado: input.estado });
    else return NextResponse.json({ error: "Selecciona un estado válido." }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo actualizar la inscripción.";
    return NextResponse.json({ error: message === "UNAUTHORIZED" ? "Inicia sesión para continuar." : message }, {
      status: message === "UNAUTHORIZED" ? 401 : 400,
    });
  }
}
