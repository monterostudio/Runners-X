import "server-only";
import { randomUUID } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase-admin";

export const collections = [
  "carreras",
  "hero",
  "galeria",
  "noticias",
  "patrocinadores",
  "resultados",
  "inscripciones",
  "demo-inscripciones",
  "administradores",
] as const;

export type Collection = (typeof collections)[number];
export type DataRecord = Record<string, unknown> & { _id: string };
export type SiteConfig = Record<string, string>;

const isCollection = (value: string): value is Collection =>
  collections.includes(value as Collection);

const urlFields = new Set([
  "media_url", "url", "imagen", "logo", "primary_url", "secondary_url", "enlace",
  "instagram", "facebook", "strava", "tiktok", "youtube", "website", "web",
]);

function validateUrls(record: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(record)) {
    if (!urlFields.has(key) || value === undefined || value === null || value === "") continue;
    if (typeof value !== "string") throw new Error(`El campo ${key} debe contener un enlace válido.`);
    const url = value.trim();
    if (url.startsWith("//") || /[\u0000-\u001f]/.test(url)) throw new Error(`El enlace del campo ${key} no es válido.`);
    if (url.startsWith("/") || url.startsWith("#") || /^(?:images|uploads)\//.test(url)) continue;
    try {
      const parsed = new URL(url);
      if (!["http:", "https:", "mailto:"].includes(parsed.protocol)) throw new Error();
    } catch {
      if (!/^(?:\.\/)?[A-Za-z0-9._/-]+(?:\.php)?(?:#[A-Za-z0-9_-]+)?$/.test(url)) {
        throw new Error(`El enlace del campo ${key} debe usar una dirección HTTPS, HTTP o una ruta del sitio.`);
      }
    }
  }
}

function localFile(collection: Collection): string {
  return path.join(process.cwd(), "data", `${collection}.json`);
}

export async function readLocalJson<T>(collection: Collection): Promise<T[]> {
  try {
    const raw = await readFile(localFile(collection), "utf8");
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) throw new Error(`data/${collection}.json debe contener una lista.`);
    return value as T[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeLocalJson(collection: Collection, value: unknown[]): Promise<void> {
  const file = localFile(collection);
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, file);
}

export async function getCollection(collectionName: string): Promise<DataRecord[]> {
  if (!isCollection(collectionName) || collectionName === "inscripciones" || collectionName === "demo-inscripciones" || collectionName === "administradores") {
    throw new Error("La colección solicitada no es pública.");
  }

  if (!isSupabaseConfigured()) {
    const records = await readLocalJson<Record<string, unknown>>(collectionName);
    return records.map((record, index) => ({
      ...record,
      _id: String(record.id ?? `local-${collectionName}-${index}`),
    }));
  }

  const { data, error } = await getSupabaseAdmin()
    .from("content_items")
    .select("item_id, payload")
    .eq("collection", collectionName)
    .order("position", { ascending: true });
  if (error) throw new Error(`No se pudo leer ${collectionName}: ${error.message}`);
  return (data ?? []).map((row) => ({
    ...(row.payload as Record<string, unknown>),
    _id: row.item_id,
  }));
}

export async function getSiteConfig(): Promise<SiteConfig> {
  if (!isSupabaseConfigured()) {
    try {
      return JSON.parse(await readFile(path.join(process.cwd(), "data", "configuracion.json"), "utf8")) as SiteConfig;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw error;
    }
  }

  const { data, error } = await getSupabaseAdmin()
    .from("content_items")
    .select("payload")
    .eq("collection", "configuracion")
    .eq("item_id", "principal")
    .maybeSingle();
  if (error) throw new Error(`No se pudo leer la configuración: ${error.message}`);
  return (data?.payload as SiteConfig | null) ?? {};
}

export async function saveSiteConfig(config: SiteConfig): Promise<void> {
  validateUrls(config);
  if (!isSupabaseConfigured()) {
    const file = path.join(process.cwd(), "data", "configuracion.json");
    const temporary = `${file}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(config, null, 2)}\n`, "utf8");
    await rename(temporary, file);
    return;
  }

  const { error } = await getSupabaseAdmin().from("content_items").upsert({
    collection: "configuracion",
    item_id: "principal",
    position: 0,
    payload: config,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`No se pudo guardar la configuración: ${error.message}`);
}

export async function saveRecord(
  collectionName: string,
  record: Record<string, unknown>,
  id?: string,
): Promise<DataRecord> {
  if (!isCollection(collectionName) || collectionName === "inscripciones" || collectionName === "demo-inscripciones" || collectionName === "administradores") {
    throw new Error("La colección solicitada no se puede modificar.");
  }
  const recordId = id || String(record.id || randomUUID());
  const payload = { ...record };
  delete payload._id;
  validateUrls(payload);
  if (["carreras", "hero", "galeria", "noticias"].includes(collectionName)) payload.id = recordId;

  if (!isSupabaseConfigured()) {
    const existing = await readLocalJson<Record<string, unknown>>(collectionName);
    const index = existing.findIndex((item, itemIndex) => String(item.id ?? `local-${collectionName}-${itemIndex}`) === recordId);
    if (index >= 0) existing[index] = payload;
    else existing.push(payload);
    await writeLocalJson(collectionName, existing);
    return { ...payload, _id: recordId };
  }

  const client = getSupabaseAdmin();
  const { data: current, error: readError } = await client
    .from("content_items")
    .select("position")
    .eq("collection", collectionName)
    .eq("item_id", recordId)
    .maybeSingle();
  if (readError) throw new Error(`No se pudo guardar ${collectionName}: ${readError.message}`);

  let position = current?.position;
  if (position === undefined) {
    const { data: last, error: orderError } = await client
      .from("content_items")
      .select("position")
      .eq("collection", collectionName)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (orderError) throw new Error(`No se pudo determinar el orden: ${orderError.message}`);
    position = (last?.position ?? -1) + 1;
    if (collectionName === "galeria" || collectionName === "noticias") position = -1;
  }

  const { error } = await client.from("content_items").upsert({
    collection: collectionName,
    item_id: recordId,
    position,
    payload,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`No se pudo guardar ${collectionName}: ${error.message}`);
  return { ...payload, _id: recordId };
}

export async function deleteRecord(collectionName: string, id: string): Promise<void> {
  if (!isCollection(collectionName) || collectionName === "inscripciones" || collectionName === "demo-inscripciones" || collectionName === "administradores") {
    throw new Error("La colección solicitada no se puede eliminar.");
  }
  if (!isSupabaseConfigured()) {
    const records = await readLocalJson<Record<string, unknown>>(collectionName);
    const remaining = records.filter((record, index) =>
      String(record.id ?? `local-${collectionName}-${index}`) !== id,
    );
    if (records.length === remaining.length) throw new Error("No se encontró el registro.");
    await writeLocalJson(collectionName, remaining);
    return;
  }

  const { error, count } = await getSupabaseAdmin()
    .from("content_items")
    .delete({ count: "exact" })
    .eq("collection", collectionName)
    .eq("item_id", id);
  if (error) throw new Error(`No se pudo eliminar el registro: ${error.message}`);
  if (!count) throw new Error("No se encontró el registro.");
}

export async function getRegistrations(): Promise<DataRecord[]> {
  const demoMode = (await getSiteConfig()).modo_demo === "true";
  if (!isSupabaseConfigured()) {
    const rows = await readLocalJson<Record<string, unknown>>(demoMode ? "demo-inscripciones" : "inscripciones");
    return rows.map((row, index) => ({ ...row, _id: String(row.id ?? `registro-${index}`) }));
  }

  const table = demoMode ? "demo_registrations" : "registrations";
  const { data, error } = await getSupabaseAdmin()
    .from(table)
    .select("id, payload")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`No se pudieron leer las inscripciones: ${error.message}`);
  return (data ?? []).map((row) => ({ ...(row.payload as Record<string, unknown>), _id: row.id }));
}

export async function createRegistration(record: Record<string, unknown>): Promise<string> {
  const demoMode = (await getSiteConfig()).modo_demo === "true";
  const id = `${demoMode ? "demo-" : ""}insc-${randomUUID()}`;
  const payload = { ...record, id };
  if (!isSupabaseConfigured()) {
    const collection = demoMode ? "demo-inscripciones" : "inscripciones";
    const registrations = await readLocalJson<Record<string, unknown>>(collection);
    registrations.unshift(payload);
    await writeLocalJson(collection, registrations);
    return id;
  }

  const table = demoMode ? "demo_registrations" : "registrations";
  const { error } = await getSupabaseAdmin().from(table).insert({
    id,
    status: "Pendiente",
    payload,
  });
  if (error) throw new Error(`No se pudo guardar la inscripción: ${error.message}`);
  return id;
}

export async function updateRegistration(id: string, update: Record<string, unknown>): Promise<void> {
  const demoMode = (await getSiteConfig()).modo_demo === "true";
  if (!isSupabaseConfigured()) {
    const collection = demoMode ? "demo-inscripciones" : "inscripciones";
    const registrations = await readLocalJson<Record<string, unknown>>(collection);
    const index = registrations.findIndex((item) => String(item.id) === id);
    if (index < 0) throw new Error("No se encontró la inscripción.");
    registrations[index] = { ...registrations[index], ...update };
    await writeLocalJson(collection, registrations);
    return;
  }

  const table = demoMode ? "demo_registrations" : "registrations";
  const client = getSupabaseAdmin();
  const { data, error: readError } = await client.from(table).select("payload").eq("id", id).single();
  if (readError) throw new Error(`No se pudo leer la inscripción: ${readError.message}`);
  const payload = { ...(data.payload as Record<string, unknown>), ...update };
  const { error } = await client.from(table).update({
    status: payload.estado ?? "Pendiente",
    payload,
  }).eq("id", id);
  if (error) throw new Error(`No se pudo actualizar la inscripción: ${error.message}`);
}

export async function deleteRegistration(id: string): Promise<void> {
  const demoMode = (await getSiteConfig()).modo_demo === "true";
  if (!isSupabaseConfigured()) {
    const collection = demoMode ? "demo-inscripciones" : "inscripciones";
    const registrations = await readLocalJson<Record<string, unknown>>(collection);
    const remaining = registrations.filter((item) => String(item.id) !== id);
    if (remaining.length === registrations.length) throw new Error("No se encontró la inscripción.");
    await writeLocalJson(collection, remaining);
    return;
  }

  const table = demoMode ? "demo_registrations" : "registrations";
  const { error, count } = await getSupabaseAdmin()
    .from(table)
    .delete({ count: "exact" })
    .eq("id", id);
  if (error) throw new Error(`No se pudo eliminar la inscripción: ${error.message}`);
  if (!count) throw new Error("No se encontró la inscripción.");
}

export async function getAdmins(): Promise<DataRecord[]> {
  if (!isSupabaseConfigured()) {
    const users = await readLocalJson<Record<string, unknown>>("administradores");
    return users.map((user, index) => ({ ...user, _id: String(user.id ?? `admin-${index}`) }));
  }

  const { data, error } = await getSupabaseAdmin()
    .from("admin_users")
    .select("id, username, email, role, created_at")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`No se pudieron leer los administradores: ${error.message}`);
  return (data ?? []).map((user) => ({ ...user, _id: user.id }));
}

export async function saveAdminUser(user: {
  id?: string;
  username: string;
  email: string;
  password_hash?: string;
  role: "owner" | "admin";
}): Promise<void> {
  const id = user.id || randomUUID();
  if (!isSupabaseConfigured()) {
    const users = await readLocalJson<Record<string, unknown>>("administradores");
    const index = users.findIndex((item, itemIndex) => String(item.id ?? `admin-${itemIndex}`) === id);
    const next = { ...users[index], ...user, id };
    if (index >= 0) users[index] = next;
    else users.push(next);
    await writeLocalJson("administradores", users);
    return;
  }

  const { error } = await getSupabaseAdmin().from("admin_users").upsert({
    id,
    username: user.username,
    email: user.email,
    role: user.role,
    ...(user.password_hash ? { password_hash: user.password_hash } : {}),
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`No se pudo guardar el administrador: ${error.message}`);
}

export async function deleteAdminUser(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const users = await readLocalJson<Record<string, unknown>>("administradores");
    const index = users.findIndex((item, itemIndex) => String(item.id ?? `admin-${itemIndex}`) === id);
    if (index < 0 || users[index].role === "owner") throw new Error("No se puede eliminar el propietario.");
    users.splice(index, 1);
    await writeLocalJson("administradores", users);
    return;
  }

  const client = getSupabaseAdmin();
  const { data: target, error: readError } = await client
    .from("admin_users")
    .select("role")
    .eq("id", id)
    .maybeSingle();
  if (readError) throw new Error(`No se pudo consultar el administrador: ${readError.message}`);
  if (!target || target.role === "owner") throw new Error("No se puede eliminar el propietario.");
  const { error } = await client.from("admin_users").delete().eq("id", id);
  if (error) throw new Error(`No se pudo eliminar el administrador: ${error.message}`);
}

export async function reorderRecord(collectionName: string, id: string, direction: "up" | "down"): Promise<void> {
  if (!isCollection(collectionName) || collectionName === "inscripciones" || collectionName === "administradores") {
    throw new Error("La colección solicitada no se puede ordenar.");
  }
  const records = await getCollection(collectionName);
  const index = records.findIndex((record) => record._id === id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= records.length) throw new Error("No se puede mover el registro en esa dirección.");
  [records[index], records[target]] = [records[target], records[index]];
  records.forEach((record, position) => {
    record.orden = position + 1;
  });

  if (!isSupabaseConfigured()) {
    const raw = records.map((record) => {
      const rest: Record<string, unknown> = { ...record };
      delete rest._id;
      return rest;
    });
    await writeLocalJson(collectionName, raw);
    return;
  }
  const client = getSupabaseAdmin();
  for (const [position, record] of records.entries()) {
    const { error } = await client
      .from("content_items")
      .update({
        position,
        payload: Object.fromEntries(Object.entries(record).filter(([key]) => key !== "_id")),
        updated_at: new Date().toISOString(),
      })
      .eq("collection", collectionName)
      .eq("item_id", record._id);
    if (error) throw new Error(`No se pudo ordenar el contenido: ${error.message}`);
  }
}

export async function replaceResults(records: Record<string, unknown>[]): Promise<void> {
  if (!isSupabaseConfigured()) {
    await writeLocalJson("resultados", records);
    return;
  }
  const items = records.map((payload) => ({ item_id: randomUUID(), payload }));
  const { error } = await getSupabaseAdmin().rpc("replace_content_collection", {
    p_collection: "resultados",
    p_items: items,
  });
  if (error) throw new Error(`No se pudieron reemplazar los resultados: ${error.message}`);
}
