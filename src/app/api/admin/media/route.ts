import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin, requireAdmin } from "@/lib/admin-auth";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase-admin";

const uploadSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm"]),
  size: z.number().int().positive(),
  purpose: z.enum(["hero", "gallery", "news", "site-logo", "partner-logo"]),
});

const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

export async function POST(request: Request) {
  try {
    await assertSameOrigin();
    await requireAdmin();
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "La carga firmada está disponible al configurar Supabase." }, { status: 503 });
    }
    const input = uploadSchema.parse(await request.json());
    const video = input.contentType.startsWith("video/");
    const allowedByPurpose: Record<string, string[]> = {
      hero: ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm"],
      gallery: ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm"],
      news: ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm"],
      "site-logo": ["image/jpeg", "image/png", "image/webp"],
      "partner-logo": ["image/jpeg", "image/png", "image/webp", "image/gif"],
    };
    const limit = video ? 50 * 1024 * 1024 : input.purpose === "site-logo" ? 3 * 1024 * 1024 : 8 * 1024 * 1024;
    if (!allowedByPurpose[input.purpose].includes(input.contentType) || input.size > limit) {
      return NextResponse.json({ error: video ? "El video debe ser MP4/WebM y no superar los 50 MB." : "La imagen supera el límite permitido para esta sección." }, { status: 413 });
    }

    const path = `${input.purpose}/${new Date().toISOString().slice(0, 7)}/${randomUUID()}.${extensions[input.contentType]}`;
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || "runnersx-media";
    const { data, error } = await getSupabaseAdmin().storage.from(bucket).createSignedUploadUrl(path, { upsert: false });
    if (error) throw new Error(`No se pudo preparar la carga: ${error.message}`);
    const { data: publicUrl } = getSupabaseAdmin().storage.from(bucket).getPublicUrl(path);
    return NextResponse.json({
      path,
      token: data.token,
      signedUrl: data.signedUrl,
      publicUrl: publicUrl.publicUrl,
      bucket,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo preparar la carga.";
    const status = message === "UNAUTHORIZED" ? 401 : error instanceof z.ZodError ? 400 : 500;
    return NextResponse.json({ error: status === 500 ? "No se pudo preparar la carga." : message }, { status });
  }
}
