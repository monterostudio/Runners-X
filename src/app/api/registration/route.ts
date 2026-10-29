import { NextResponse } from "next/server";
import { z } from "zod";
import { createRegistration, getCollection } from "@/lib/data";

const registrationSchema = z.object({
  nombre: z.string().trim().min(2).max(120),
  documento: z.string().trim().min(3).max(40),
  email: z.string().trim().email().max(254),
  telefono: z.string().trim().min(5).max(40),
  carrera_id: z.string().min(1).max(100),
  talla: z.enum(["XS", "S", "M", "L", "XL"]),
  club: z.string().trim().max(120).optional().default("Independiente"),
  contacto_emergencia: z.string().trim().min(3).max(120),
});

function raceStatus(race: Record<string, unknown>, now: number): "abierta" | "proxima" | "cerrada" | "inactiva" {
  if (race.activa === false) return "inactiva";
  const open = typeof race.apertura === "string" && race.apertura ? Date.parse(race.apertura) : null;
  const close = typeof race.cierre === "string" && race.cierre ? Date.parse(race.cierre) : null;
  if ((open !== null && !Number.isFinite(open)) || (close !== null && !Number.isFinite(close))) return "cerrada";
  if (open !== null && now < open) return "proxima";
  if (close !== null && now >= close) return "cerrada";
  return "abierta";
}

export async function POST(request: Request) {
  try {
    const data = registrationSchema.parse(await request.json());
    const races = await getCollection("carreras");
    const race = races.find((item) => String(item.id ?? item._id) === data.carrera_id);
    if (!race) return NextResponse.json({ error: "Selecciona un circuito disponible." }, { status: 400 });

    const status = raceStatus(race, Date.now());
    if (status !== "abierta") {
      const messages = {
        proxima: "Las inscripciones para este circuito todavía no han abierto.",
        cerrada: "El periodo de inscripción de este circuito ya cerró.",
        inactiva: "Este circuito no está recibiendo inscripciones.",
      };
      return NextResponse.json({ error: messages[status] }, { status: 400 });
    }

    const id = await createRegistration({
      fecha: new Date().toISOString(),
      ...data,
      club: data.club || "Independiente",
      carrera: race.nombre,
      distancia: race.distancia,
      estado: "Pendiente",
    });
    return NextResponse.json({
      success: true,
      id,
      message: "Tu inscripción fue recibida y quedó pendiente de revisión por el equipo.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo enviar la inscripción.";
    const status = error instanceof z.ZodError ? 400 : 500;
    return NextResponse.json({ error: status === 500 ? "No se pudo guardar la inscripción. Inténtalo nuevamente." : message }, { status });
  }
}
