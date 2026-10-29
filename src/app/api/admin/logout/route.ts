import { NextResponse } from "next/server";
import { assertSameOrigin, destroyAdminSession } from "@/lib/admin-auth";

export async function POST() {
  try {
    await assertSameOrigin();
    await destroyAdminSession();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cerrar sesión." },
      { status: 403 },
    );
  }
}
