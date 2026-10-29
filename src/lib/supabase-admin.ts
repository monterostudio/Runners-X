import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

export function getSupabaseAdmin(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Configura NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.");
  }

  client = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}

export function isSupabaseConfigured(): boolean {
  const hasUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const hasServiceKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (hasUrl !== hasServiceKey) {
    throw new Error("Configura tanto NEXT_PUBLIC_SUPABASE_URL como SUPABASE_SERVICE_ROLE_KEY.");
  }
  if (process.env.VERCEL === "1" && !hasUrl) {
    throw new Error("Supabase debe estar configurado en Vercel para usar datos persistentes.");
  }
  return hasUrl && hasServiceKey;
}
