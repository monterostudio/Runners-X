import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { assertSameOrigin, requireAdmin } from "@/lib/admin-auth";
import { isSupabaseConfigured } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const limits: Record<string, number> = {
  "image/jpeg": 8 * 1024 * 1024,
  "image/png": 8 * 1024 * 1024,
  "image/webp": 8 * 1024 * 1024,
  "image/gif": 8 * 1024 * 1024,
  "video/mp4": 50 * 1024 * 1024,
  "video/webm": 50 * 1024 * 1024,
};
const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
};
const allowedByPurpose: Record<string, string[]> = {
  hero: ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm"],
  gallery: ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm"],
  news: ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm"],
  "site-logo": ["image/jpeg", "image/png", "image/webp"],
  "partner-logo": ["image/jpeg", "image/png", "image/webp", "image/gif"],
};

function matchesType(bytes: Uint8Array, type: string): boolean {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10";
  if (type === "image/gif") return new TextDecoder().decode(bytes.slice(0, 6)).match(/^GIF8[79]a$/) !== null;
  if (type === "image/webp") return new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  if (type === "video/mp4") return new TextDecoder().decode(bytes.slice(4, 8)) === "ftyp";
  if (type === "video/webm") return bytes.slice(0, 4).join(",") === "26,69,223,163";
  return false;
}

export async function POST(request: Request) {
  try {
    await assertSameOrigin();
    await requireAdmin();
    if (isSupabaseConfigured()) return NextResponse.json({ error: "Usa la carga firmada de Supabase." }, { status: 400 });
    const form = await request.formData();
    const file = form.get("file");
    const purpose = form.get("purpose");
    if (!(file instanceof File) || typeof purpose !== "string" || !["hero", "gallery", "news", "site-logo", "partner-logo"].includes(purpose)) {
      return NextResponse.json({ error: "Selecciona un archivo multimedia válido." }, { status: 400 });
    }
    const limit = purpose === "site-logo" ? 3 * 1024 * 1024 : limits[file.type];
    if (!allowedByPurpose[purpose].includes(file.type) || !limit || file.size < 1 || file.size > limit) {
      return NextResponse.json({ error: "El archivo supera el límite permitido o su formato no está admitido." }, { status: 413 });
    }
    const buffer = new Uint8Array(await file.arrayBuffer());
    if (!matchesType(buffer, file.type)) {
      return NextResponse.json({ error: "El contenido no coincide con el formato declarado." }, { status: 400 });
    }
    const folder = path.join(process.cwd(), "public", "uploads", purpose);
    await mkdir(folder, { recursive: true });
    const filename = `${randomUUID()}.${extensions[file.type]}`;
    await writeFile(path.join(folder, filename), buffer, { flag: "wx" });
    return NextResponse.json({ url: `/uploads/${purpose}/${filename}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo guardar el archivo.";
    const status = message === "UNAUTHORIZED" ? 401 : message.includes("origen válido") || message.includes("otro origen") ? 403 : 500;
    return NextResponse.json({ error: status === 500 ? "No se pudo guardar el archivo." : message }, { status });
  }
}
