import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, requireAdmin } from "@/lib/admin-auth";
import { getSiteConfig, saveSiteConfig } from "@/lib/data";

const configSchema = z.record(z.string(), z.string().max(2000));

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json(await getSiteConfig());
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo leer la configuración.";
    return NextResponse.json({ error: message === "UNAUTHORIZED" ? "Inicia sesión." : message }, { status: message === "UNAUTHORIZED" ? 401 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    await assertSameOrigin();
    const session = await requireAdmin();
    const config = configSchema.parse(await request.json());
    if (session.role === "demo" && config.modo_demo !== "true") {
      return NextResponse.json({ error: "La cuenta demo no puede desactivar el modo de demostración." }, { status: 403 });
    }
    await saveSiteConfig(config);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo guardar la configuración.";
    return NextResponse.json({ error: message === "UNAUTHORIZED" ? "Inicia sesión." : message }, { status: message === "UNAUTHORIZED" ? 401 : error instanceof z.ZodError ? 400 : 500 });
  }
}
