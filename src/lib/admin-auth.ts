import "server-only";
import { compare } from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { getSiteConfig, readLocalJson } from "@/lib/data";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase-admin";

export const ADMIN_COOKIE = "runnersx_admin";
const SESSION_SECONDS = 60 * 60 * 8;

export type AdminSession = {
  id: string;
  username: string;
  email: string;
  role: "owner" | "admin" | "demo";
};

function sessionSecret(): Uint8Array {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if ((!secret || secret.length < 32) && process.env.NODE_ENV === "production") {
    throw new Error("ADMIN_SESSION_SECRET debe tener al menos 32 caracteres en producción.");
  }
  return new TextEncoder().encode(secret || "runners-x-local-session-secret-change-me");
}

export async function verifyCredentials(username: string, password: string): Promise<AdminSession | null> {
  if (!username.trim() || !password) return null;
  let user: Record<string, unknown> | undefined;

  const supabaseConfigured = isSupabaseConfigured();
  if (supabaseConfigured) {
    const { data, error } = await getSupabaseAdmin()
      .from("admin_users")
      .select("id, username, email, password_hash, role")
      .ilike("username", username.trim())
      .maybeSingle();
    if (error) throw new Error(`No se pudo validar el acceso: ${error.message}`);
    user = data ?? undefined;
  } else {
    const users = await readLocalJson<Record<string, unknown>>("administradores");
    const index = users.findIndex((item) => String(item.username ?? "").toLowerCase() === username.trim().toLowerCase());
    if (index >= 0) user = { ...users[index], id: users[index].id ?? `admin-${index}` };
  }

  if (!user || typeof user.password_hash !== "string") return null;
  const hash = user.password_hash.replace(/^\$2y\$/, "$2b$");
  if (!(await compare(password, hash))) return null;
  if (user.role === "demo" && (supabaseConfigured || (await getSiteConfig()).modo_demo !== "true")) return null;

  return {
    id: String(user.id ?? ""),
    username: String(user.username ?? ""),
    email: String(user.email ?? ""),
    role: user.role === "owner" ? "owner" : user.role === "demo" && !supabaseConfigured ? "demo" : "admin",
  };
}

export async function createAdminSession(user: AdminSession): Promise<void> {
  const token = await new SignJWT({
    username: user.username,
    email: user.email,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_SECONDS}s`)
    .sign(sessionSecret());

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionSecret(), { algorithms: ["HS256"] });
    if (
      typeof payload.sub !== "string" ||
      typeof payload.username !== "string" ||
      typeof payload.email !== "string" ||
      (payload.role !== "owner" && payload.role !== "admin" && payload.role !== "demo")
    ) {
      return null;
    }
    if (payload.role === "demo" && (
      isSupabaseConfigured() ||
      (await getSiteConfig()).modo_demo !== "true"
    )) return null;
    return {
      id: payload.sub,
      username: payload.username,
      email: payload.email,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

export async function destroyAdminSession(): Promise<void> {
  (await cookies()).delete(ADMIN_COOKIE);
}

export async function assertSameOrigin(): Promise<void> {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!origin || !host) throw new Error("La solicitud no tiene un origen válido.");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new Error("La solicitud no tiene un origen válido.");
  }
  if (originHost !== host) throw new Error("La solicitud proviene de otro origen.");
}

export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}
