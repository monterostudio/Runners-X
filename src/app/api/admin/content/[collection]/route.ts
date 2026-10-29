import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, requireAdmin } from "@/lib/admin-auth";
import { deleteRecord, getCollection, reorderRecord, saveRecord } from "@/lib/data";

const mutationSchema = z.object({
  action: z.enum(["create", "update", "delete", "reorder"]),
  id: z.string().optional(),
  record: z.record(z.string(), z.unknown()).optional(),
  direction: z.enum(["up", "down"]).optional(),
});

type RouteContext = { params: Promise<{ collection: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    await requireAdmin();
    const { collection } = await params;
    return NextResponse.json(await getCollection(collection));
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudieron leer los datos.";
    return NextResponse.json({ error: message === "UNAUTHORIZED" ? "Inicia sesión para continuar." : message }, {
      status: message === "UNAUTHORIZED" ? 401 : 400,
    });
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    await assertSameOrigin();
    const session = await requireAdmin();
    const { collection } = await params;
    const input = mutationSchema.parse(await request.json());

    if (input.action === "reorder") {
      if (!input.id || !input.direction) return NextResponse.json({ error: "Elige un registro y una dirección." }, { status: 400 });
      await reorderRecord(collection, input.id, input.direction);
      return NextResponse.json({ success: true });
    }

    if (input.action === "delete") {
      if (!input.id) return NextResponse.json({ error: "Falta el identificador del registro." }, { status: 400 });
      await deleteRecord(collection, input.id);
      return NextResponse.json({ success: true });
    }

    if (!input.record) return NextResponse.json({ error: "Completa los datos del registro." }, { status: 400 });
    if (collection === "administradores" && session.role !== "owner") {
      return NextResponse.json({ error: "Solo el propietario puede gestionar administradores." }, { status: 403 });
    }
    const saved = await saveRecord(collection, input.record, input.action === "update" ? input.id : undefined);
    return NextResponse.json(saved);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo guardar el contenido.";
    const status = message === "UNAUTHORIZED" ? 401 : error instanceof z.ZodError ? 400 : 400;
    return NextResponse.json({ error: message === "UNAUTHORIZED" ? "Inicia sesión para continuar." : message }, { status });
  }
}
