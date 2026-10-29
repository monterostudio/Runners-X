"use client";

import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import type { DataRecord, SiteConfig } from "@/lib/data";
import type { AdminSession } from "@/lib/admin-auth";
import { assetUrl } from "@/lib/public-links";
import { isVideoFileUrl, socialMediaPlatform } from "@/lib/media-embed";
import { SocialVideoFrame } from "@/components/site";
import "./admin-console.css";

type Field = {
  key: string;
  label: string;
  type?: "text" | "number" | "textarea" | "select" | "checkbox" | "datetime" | "media";
  options?: string[];
  purpose?: string;
  hint?: string;
  group?: "primary" | "secondary";
};
type Resource = { label: string; icon: string; fields: Field[] };

const resources: Record<string, Resource> = {
  carreras: { label: "Carreras", icon: "fa-person-running", fields: [
    { key: "nombre", label: "Nombre de la carrera" }, { key: "distancia", label: "Distancia" },
    { key: "desnivel", label: "Desnivel" }, { key: "altitud_minima", label: "Altitud mínima", type: "number" },
    { key: "altitud_maxima", label: "Altitud máxima", type: "number" }, { key: "terreno", label: "Terreno" },
    { key: "apertura", label: "Apertura de inscripciones", type: "datetime", hint: "Déjalo vacío para abrir inmediatamente." },
    { key: "cierre", label: "Cierre de inscripciones", type: "datetime", hint: "Déjalo vacío si no quieres programar el cierre." },
    { key: "activa", label: "Carrera disponible", type: "checkbox" },
  ] },
  hero: { label: "Diapositivas", icon: "fa-images", fields: [
    { key: "etiqueta", label: "Etiqueta" }, { key: "titulo", label: "Título" },
    { key: "descripcion", label: "Descripción", type: "textarea" }, { key: "insignia", label: "Insignia" },
    { key: "media_type", label: "Tipo de medio", type: "select", options: ["imagen", "video"] },
    { key: "media_url", label: "Imagen o video", type: "media", purpose: "hero", hint: "Pega una URL o selecciona un archivo. Video MP4/WebM hasta 50 MB." },
    { key: "show_distances", label: "Mostrar distancias en el título", type: "checkbox" },
    { key: "primary_label", label: "Texto del botón", group: "primary" },
    { key: "primary_action", label: "Acción", type: "select", options: ["registration", "link"], group: "primary" },
    { key: "primary_url", label: "Enlace del botón", group: "primary" },
    { key: "secondary_label", label: "Texto del botón", group: "secondary" },
    { key: "secondary_action", label: "Acción", type: "select", options: ["link", "registration"], group: "secondary" },
    { key: "secondary_url", label: "Enlace del botón", group: "secondary" },
  ] },
  galeria: { label: "Galería", icon: "fa-photo-film", fields: [
    { key: "titulo", label: "Título de la imagen" }, { key: "subtitulo", label: "Descripción o categoría" },
    { key: "media_type", label: "Tipo de medio", type: "select", options: ["imagen", "video"] },
    { key: "url", label: "Imagen o video", type: "media", purpose: "gallery" },
  ] },
  noticias: { label: "Noticias", icon: "fa-newspaper", fields: [
    { key: "titulo", label: "Título" }, { key: "categoria", label: "Categoría" },
    { key: "fecha", label: "Fecha de publicación" }, { key: "autor", label: "Autor" },
    { key: "tiempo_lectura", label: "Tiempo de lectura" }, { key: "resumen", label: "Resumen", type: "textarea" },
    { key: "contenido", label: "Contenido", type: "textarea" }, { key: "media_type", label: "Tipo de medio", type: "select", options: ["imagen", "video"] },
    { key: "imagen", label: "Imagen o video", type: "media", purpose: "news" },
  ] },
  patrocinadores: { label: "Marcas aliadas", icon: "fa-handshake", fields: [
    { key: "nombre", label: "Nombre de la marca" }, { key: "logo", label: "Logo", type: "media", purpose: "partner-logo" },
    { key: "enlace", label: "Enlace del sitio web" },
  ] },
  resultados: { label: "Resultados", icon: "fa-ranking-star", fields: [
    { key: "posicion", label: "Posición", type: "number" }, { key: "nombre", label: "Nombre del corredor" },
    { key: "dorsal", label: "Dorsal" }, { key: "distancia", label: "Distancia" },
    { key: "categoria", label: "Categoría" }, { key: "tiempo", label: "Tiempo oficial" }, { key: "ritmo", label: "Ritmo medio" },
  ] },
};

const navItems = [
  ["inicio", "Resumen", "fa-chart-line"],
  ["carreras", "Carreras", "fa-person-running"],
  ["hero", "Diapositivas", "fa-images"],
  ["galeria", "Galería", "fa-photo-film"],
  ["noticias", "Noticias", "fa-newspaper"],
  ["resultados", "Resultados", "fa-ranking-star"],
  ["patrocinadores", "Marcas aliadas", "fa-handshake"],
  ["inscripciones", "Inscripciones", "fa-clipboard-list"],
  ["configuracion", "Configuración", "fa-gear"],
];

type Props = {
  initialSession: AdminSession | null;
  setupRequired: boolean;
  demoMode?: boolean;
  localDemo?: boolean;
  initialData?: Record<string, DataRecord[]>;
  initialRegistrations?: DataRecord[];
  initialConfig?: SiteConfig;
  initialAdmins?: DataRecord[];
};

async function responseJson(response: Response) {
  const body: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body ? String(body.error) : "La operación no se pudo completar.";
    throw new Error(message);
  }
  return body as Record<string, unknown>;
}

function csvEscape(value: unknown): string {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function downloadCsv(filename: string, rows: DataRecord[]) {
  if (!rows.length) return;
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row).filter((key) => key !== "_id" && key !== "id")))];
  const csv = [columns.map(csvEscape).join(","), ...rows.map((row) => columns.map((key) => csvEscape(row[key])).join(","))].join("\r\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] ?? character);
}

function registrationPdfValue(key: string, value: unknown): string {
  if (["fecha", "fecha_registro", "created_at"].includes(key) && typeof value === "string") return formatAdminDate(value);
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value ?? "");
}

function printRegistrationsPdf(rows: DataRecord[]): boolean {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return false;

  printWindow.opener = null;
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row).filter((key) => key !== "_id" && key !== "id")))];
  const headings = columns.map((key) => `<th>${escapeHtml(key.replaceAll("_", " "))}</th>`).join("");
  const body = rows.map((row) => `<tr>${columns.map((key) => `<td>${escapeHtml(registrationPdfValue(key, row[key]))}</td>`).join("")}</tr>`).join("");
  printWindow.document.open();
  printWindow.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Inscripciones Runners X</title><style>
    @page{size:landscape;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#17212b;margin:0;font-size:10px}
    h1{font-size:20px;margin:0 0 5px}p{color:#52606d;margin:0 0 16px}
    table{width:100%;border-collapse:collapse;table-layout:auto}thead{display:table-header-group}
    th,td{border:1px solid #cbd3da;padding:6px 7px;text-align:left;vertical-align:top;overflow-wrap:anywhere}
    th{background:#edf1f4;font-size:9px;text-transform:uppercase}tr{break-inside:avoid}
    @media screen{body{padding:24px}h1{color:#101820}}
  </style></head><body><h1>Inscripciones Runners X</h1><p>${rows.length} registros · Generado ${escapeHtml(new Intl.DateTimeFormat("es-VE", { dateStyle: "long" }).format(new Date()))}</p><table><thead><tr>${headings}</tr></thead><tbody>${body}</tbody></table></body></html>`);
  printWindow.document.close();
  printWindow.onafterprint = () => printWindow.close();
  window.setTimeout(() => {
    if (!printWindow.closed) {
      printWindow.focus();
      printWindow.print();
    }
  }, 300);
  return true;
}

function withLogo(config: SiteConfig): SiteConfig {
  return { logo: "", ...config };
}

export function AdminConsole({ initialSession, setupRequired, demoMode = false, localDemo = false, initialData = {}, initialRegistrations = [], initialConfig = {}, initialAdmins = [] }: Props) {
  const [session, setSession] = useState<AdminSession | null>(initialSession);
  const [setupPending, setSetupPending] = useState(setupRequired);
  const [tab, setTab] = useState("inicio");
  const [data, setData] = useState(initialData);
  const [registrations, setRegistrations] = useState(initialRegistrations);
  const [config, setConfig] = useState<SiteConfig>(() => withLogo(initialConfig));
  const [admins, setAdmins] = useState(initialAdmins);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<{ collection: string; record?: DataRecord } | null>(null);
  const [adminEditor, setAdminEditor] = useState<DataRecord | null>(null);

  const filteredRecords = useMemo(() => {
    const rows = data[tab] ?? [];
    const query = search.trim().toLowerCase();
    return query ? rows.filter((row) => Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(query))) : rows;
  }, [data, search, tab]);

  async function loadData(collection: string) {
    const result = await responseJson(await fetch(`/api/admin/content/${collection}`, { cache: "no-store" }));
    setData((current) => ({ ...current, [collection]: result as unknown as DataRecord[] }));
  }

  async function loadRegistrations() {
    const result = await responseJson(await fetch("/api/admin/registrations", { cache: "no-store" }));
    setRegistrations(result as unknown as DataRecord[]);
  }

  async function loadAdmins() {
    const result = await responseJson(await fetch("/api/admin/users", { cache: "no-store" }));
    setAdmins(result as unknown as DataRecord[]);
  }

  async function importResults(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!window.confirm("La importación reemplazará todos los resultados actuales. ¿Continuar?")) {
      event.target.value = "";
      return;
    }
    setBusy(true);
    setNotice(null);
    const form = new FormData();
    form.set("file", file);
    try {
      const result = await responseJson(await fetch("/api/admin/results/import", { method: "POST", body: form }));
      await loadData("resultados");
      setNotice({ ok: true, text: `Se importaron ${String(result.count)} resultados.` });
    } catch (error) {
      setNotice({ ok: false, text: error instanceof Error ? error.message : "No se pudo importar el CSV." });
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setNotice(null);
    try {
      const values = Object.fromEntries(new FormData(form).entries());
      const result = await responseJson(await fetch("/api/admin/login", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values),
      }));
      setSession(result.user as AdminSession);
      setNotice({ ok: true, text: "Sesión iniciada." });
      form.reset();
      const [races, slides, gallery, news, sponsors, results, registrationsResponse, configResponse] = await Promise.all([
        fetch("/api/admin/content/carreras").then(responseJson),
        fetch("/api/admin/content/hero").then(responseJson),
        fetch("/api/admin/content/galeria").then(responseJson),
        fetch("/api/admin/content/noticias").then(responseJson),
        fetch("/api/admin/content/patrocinadores").then(responseJson),
        fetch("/api/admin/content/resultados").then(responseJson),
        fetch("/api/admin/registrations").then(responseJson),
        fetch("/api/admin/config").then(responseJson),
      ]);
      setData({ carreras: races as unknown as DataRecord[], hero: slides as unknown as DataRecord[], galeria: gallery as unknown as DataRecord[], noticias: news as unknown as DataRecord[], patrocinadores: sponsors as unknown as DataRecord[], resultados: results as unknown as DataRecord[] });
      setRegistrations(registrationsResponse as unknown as DataRecord[]);
      setConfig(withLogo(configResponse as SiteConfig));
      if (result.user && (result.user as AdminSession).role === "owner") await loadAdmins();
    } catch (error) {
      setNotice({ ok: false, text: error instanceof Error ? error.message : "No se pudo iniciar sesión." });
    } finally {
      setBusy(false);
    }
  }

  async function createOwner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setNotice(null);
    try {
      const values = Object.fromEntries(new FormData(form).entries());
      await responseJson(await fetch("/api/admin/setup", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values),
      }));
      setSetupPending(false);
      setNotice({ ok: true, text: "Propietario creado. Ya puedes iniciar sesión." });
      form.reset();
    } catch (error) {
      setNotice({ ok: false, text: error instanceof Error ? error.message : "No se pudo crear el propietario." });
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    try {
      await responseJson(await fetch("/api/admin/logout", { method: "POST" }));
      setSession(null);
      setData({});
      setRegistrations([]);
      setConfig({});
      setAdmins([]);
      setTab("inicio");
    } catch (error) {
      setNotice({ ok: false, text: error instanceof Error ? error.message : "No se pudo cerrar sesión." });
    } finally {
      setBusy(false);
    }
  }

  async function mutateCollection(collection: string, action: string, body: Record<string, unknown>) {
    setBusy(true);
    setNotice(null);
    try {
      await responseJson(await fetch(`/api/admin/content/${collection}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...body }),
      }));
      await loadData(collection);
      setDialog(null);
      setNotice({ ok: true, text: "Cambios guardados correctamente." });
    } catch (error) {
      setNotice({ ok: false, text: error instanceof Error ? error.message : "No se pudo guardar." });
    } finally {
      setBusy(false);
    }
  }

  async function mutateRegistration(id: string, action: "update" | "delete", estado?: string) {
    if (action === "delete" && !window.confirm("¿Eliminar esta inscripción? Esta acción no se puede deshacer.")) return;
    setBusy(true);
    try {
      await responseJson(await fetch("/api/admin/registrations", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, id, estado }),
      }));
      await loadRegistrations();
      setNotice({ ok: true, text: "Inscripción actualizada." });
    } catch (error) {
      setNotice({ ok: false, text: error instanceof Error ? error.message : "No se pudo actualizar la inscripción." });
    } finally {
      setBusy(false);
    }
  }

  async function saveAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    if (!values.password) delete values.password;
    setBusy(true);
    try {
      await responseJson(await fetch("/api/admin/users", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: adminEditor ? "update" : "create", ...(adminEditor ? { id: adminEditor._id } : {}), ...values }),
      }));
      setAdminEditor(null);
      await loadAdmins();
      setNotice({ ok: true, text: "Cuenta de administrador guardada." });
    } catch (error) {
      setNotice({ ok: false, text: error instanceof Error ? error.message : "No se pudo guardar la cuenta." });
    } finally {
      setBusy(false);
    }
  }

  async function removeAdmin(id: string) {
    if (!window.confirm("¿Eliminar esta cuenta de administrador?")) return;
    setBusy(true);
    try {
      await responseJson(await fetch("/api/admin/users", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id }),
      }));
      await loadAdmins();
      setNotice({ ok: true, text: "Cuenta eliminada." });
    } catch (error) {
      setNotice({ ok: false, text: error instanceof Error ? error.message : "No se pudo eliminar la cuenta." });
    } finally {
      setBusy(false);
    }
  }

  async function saveConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      await responseJson(await fetch("/api/admin/config", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(config),
      }));
      setNotice({ ok: true, text: "Configuración guardada." });
    } catch (error) {
      setNotice({ ok: false, text: error instanceof Error ? error.message : "No se pudo guardar la configuración." });
    } finally {
      setBusy(false);
    }
  }

  async function uploadMedia(file: File, purpose: string): Promise<string> {
    setBusy(true);
    try {
      const accepted = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm"];
      if (!accepted.includes(file.type)) throw new Error("Formato no admitido. Usa JPG, PNG, WebP, GIF, MP4 o WebM.");
      const isVideo = file.type.startsWith("video/");
      const limit = purpose === "site-logo" ? 3 * 1024 * 1024 : isVideo ? 50 * 1024 * 1024 : 8 * 1024 * 1024;
      if (file.size > limit) throw new Error(isVideo ? "El video no debe superar 50 MB." : "La imagen supera el límite permitido.");

      if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
        if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) throw new Error("Configura NEXT_PUBLIC_SUPABASE_ANON_KEY para cargar medios.");
        const signed = await responseJson(await fetch("/api/admin/media", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size, purpose }),
        }));
        const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
        const { error } = await client.storage.from(String(signed.bucket)).uploadToSignedUrl(String(signed.path), String(signed.token), file, { contentType: file.type });
        if (error) throw new Error(`No se pudo subir el archivo: ${error.message}`);
        return String(signed.publicUrl);
      }

      const form = new FormData();
      form.set("file", file);
      form.set("purpose", purpose);
      const result = await responseJson(await fetch("/api/admin/media/local", { method: "POST", body: form }));
      return String(result.url);
    } finally {
      setBusy(false);
    }
  }

  async function saveRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = resources[dialog?.collection ?? ""]?.fields ?? [];
    const values: Record<string, unknown> = dialog?.record ? { ...dialog.record } : {};
    for (const field of fields) {
      const input = form.elements.namedItem(field.key);
      if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement || input instanceof HTMLSelectElement)) continue;
      if (field.type === "checkbox" && input instanceof HTMLInputElement) values[field.key] = input.checked;
      else if (field.type === "number") values[field.key] = input.value === "" ? "" : Number(input.value);
      else if (field.type === "datetime") values[field.key] = input.value ? new Date(input.value).toISOString() : "";
      else values[field.key] = input.value.trim();
    }
    if (dialog?.collection === "hero" && !values.orden) values.orden = (data.hero?.length ?? 0) + 1;
    await mutateCollection(dialog?.collection ?? "", dialog?.record ? "update" : "create", { ...(dialog?.record ? { id: dialog.record._id } : {}), record: values });
  }

  function updateField(collection: string, record?: DataRecord) {
    setDialog({ collection, record });
  }

  async function changeOrder(collection: string, id: string, direction: "up" | "down") {
    await mutateCollection(collection, "reorder", { id, direction });
  }

  if (!session) {
    return <main className="admin-auth-page admin-page">
      <div className="admin-login-box">
        <img src="/images/logo-miranda-runners.svg" alt="Runners X" className="admin-login-logo" />
        <h1 className="admin-login-title">{setupRequired ? "Configurar propietario" : "Administración de Runners X"}</h1>
        <p className="admin-login-description">{setupPending ? "Crea la cuenta principal con la clave definida en ADMIN_SETUP_KEY." : "Ingresa con tu cuenta autorizada para administrar el portal."}</p>
        {demoMode && <p className="demo-mode-banner">{localDemo ? "Demo local: contenido de ejemplo. No introduzcas datos personales reales." : "Demo de presentación: las inscripciones se guardan separadas de los registros reales."}</p>}
        {notice && <p className={`admin-notice ${notice.ok ? "success" : "error"}`} role="status">{notice.text}</p>}
        {setupPending ? <form className="admin-auth-form" onSubmit={createOwner}>
          <label>Clave de instalación<input className="admin-input" name="setupKey" type="password" autoComplete="off" placeholder="Ingresa la clave de instalación" required /></label>
          <label>Usuario<input className="admin-input" name="username" minLength={3} maxLength={32} autoComplete="username" placeholder="Crea un nombre de usuario" required /></label>
          <label>Correo electrónico<input className="admin-input" name="email" type="email" autoComplete="email" placeholder="nombre@ejemplo.com" required /></label>
          <label>Contraseña (mínimo 12 caracteres)<input className="admin-input" name="password" type="password" minLength={12} autoComplete="new-password" placeholder="Crea una contraseña segura" required /></label>
          <button className="btn-primary" type="submit" disabled={busy}>{busy ? "Creando…" : "Crear propietario"}</button>
        </form> : <form className="admin-auth-form" onSubmit={signIn}>
          <label>Usuario<input className="admin-input" name="username" autoComplete="username" placeholder="Ingresa tu usuario" required /></label>
          <label>Contraseña<input className="admin-input" name="password" type="password" autoComplete="current-password" placeholder="Ingresa tu contraseña" required /></label>
          <button className="btn-primary" type="submit" disabled={busy}>{busy ? "Validando…" : "Iniciar sesión"}</button>
        </form>}
        <Link href="/" className="admin-back-link">Volver al portal</Link>
      </div>
    </main>;
  }

  const resource = resources[tab];
  const counts = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value.length]));

  return <main className="admin-page">
    <header className="admin-topbar">
      <Link href="/" className="admin-console-brand"><img src="/images/logo-miranda-runners.svg" alt="Runners X" /></Link>
      <div className="admin-topbar-actions"><Link href="/" className="admin-view-site"><i className="fa-solid fa-arrow-up-right-from-square" /> Ver portal</Link><button type="button" className="admin-logout" onClick={signOut} disabled={busy}><i className="fa-solid fa-right-from-bracket" /> Cerrar sesión</button></div>
    </header>
    <div className="container admin-container-fluid">
      {demoMode && <p className="demo-mode-banner">{localDemo ? "Demo local: los cambios se guardan en archivos de desarrollo y no en Supabase. Usa solo datos ficticios." : "Demo de presentación: el contenido es ilustrativo y las inscripciones se guardan en el espacio demo separado."}</p>}
      <nav className="admin-tabs" aria-label="Menú de administración">
        {navItems.filter(([key]) => key !== "configuracion" || session.role === "owner" || session.role === "admin" || session.role === "demo").map(([key, label, icon]) =>
          <button type="button" key={key} className={`admin-tab-btn ${tab === key ? "active" : ""}`} onClick={() => { setTab(key); setSearch(""); if (key === "inscripciones") void loadRegistrations(); if (key === "configuracion") { void fetch("/api/admin/config").then(responseJson).then((value) => setConfig(withLogo(value as SiteConfig))).catch((error: unknown) => setNotice({ ok: false, text: error instanceof Error ? error.message : "No se pudo leer la configuración." })); if (session.role === "owner") void loadAdmins(); } }}>
            <i className={`fa-solid ${icon}`} /><span>{label}</span>
          </button>)}
      </nav>
      {notice && <div className={`admin-notice ${notice.ok ? "success" : "error"}`} role="status">{notice.text}<button type="button" onClick={() => setNotice(null)} aria-label="Cerrar aviso">×</button></div>}

      {tab === "inicio" && <section className="admin-dashboard">
        <div className="admin-section-heading"><div><span className="admin-kicker">PANEL DE CONTROL</span><h1>Resumen general</h1><p>Administra el contenido y la actividad del portal.</p></div></div>
        <div className="admin-stat-grid">
          {[
            ["Carreras disponibles", counts.carreras ?? 0, "fa-person-running", "carreras"],
            ["Diapositivas activas", counts.hero ?? 0, "fa-images", "hero"],
            ["Inscripciones", registrations.length, "fa-clipboard-list", "inscripciones"],
            ["Resultados publicados", counts.resultados ?? 0, "fa-ranking-star", "resultados"],
          ].map(([label, count, icon, key]) => <button type="button" key={String(key)} className="admin-stat-card" onClick={() => setTab(String(key))}><span className="admin-stat-icon"><i className={`fa-solid ${icon}`} /></span><span className="admin-stat-value">{count}</span><span className="admin-stat-label">{label}</span></button>)}
        </div>
        <section className="admin-card admin-dashboard-note"><h2 className="admin-card-title">Todo listo para gestionar</h2><p>Usa el menú para actualizar carreras, noticias, galería, clasificaciones, registro y configuración del sitio.</p></section>
      </section>}

      {resource && <section className="admin-content-panel">
        <div className="admin-section-heading">
          <div><span className="admin-kicker">CONTENIDO DEL PORTAL</span><h1>{resource.label}</h1><p>{data[tab]?.length ?? 0} registros</p></div>
          <button type="button" className="btn-primary admin-action-button" onClick={() => updateField(tab)}><i className="fa-solid fa-plus" /> Añadir</button>
        </div>
        <div className="admin-toolbar"><label className="admin-search"><i className="fa-solid fa-magnifying-glass" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Buscar ${resource.label.toLowerCase()}`} /></label>{tab === "resultados" && <div className="admin-csv-actions"><label className={`admin-outline-button ${busy ? "disabled" : ""}`}><i className="fa-solid fa-file-arrow-up" /> Importar CSV<input type="file" accept=".csv,text/csv" disabled={busy} onChange={importResults} /></label><button className="admin-outline-button" type="button" onClick={() => downloadCsv("resultados-runners-x.csv", filteredRecords)}><i className="fa-solid fa-download" /> Exportar CSV</button></div>}</div>
        {tab === "resultados" ? <div className="admin-table-scroll"><table className="admin-record-table admin-results-table"><colgroup><col className="col-position" /><col className="col-runner" /><col className="col-bib" /><col className="col-distance" /><col className="col-category" /><col className="col-time" /><col className="col-actions" /></colgroup><thead><tr><th>Posición</th><th>Corredor</th><th>Dorsal</th><th>Distancia</th><th>Categoría</th><th>Tiempo</th><th>Acciones</th></tr></thead><tbody>
          {filteredRecords.map((record) => <tr key={record._id}><td>{String(record.posicion ?? "")}</td><td>{String(record.nombre ?? "")}</td><td>{String(record.dorsal ?? "")}</td><td>{String(record.distancia ?? "")}</td><td>{String(record.categoria ?? "")}</td><td>{String(record.tiempo ?? "")}</td><td><RecordActions record={record} onEdit={() => updateField(tab, record)} onDelete={() => mutateCollection(tab, "delete", { id: record._id })} /></td></tr>)}
          {!filteredRecords.length && <tr><td colSpan={7} className="admin-empty">Aún no hay resultados. Añade el primero.</td></tr>}
        </tbody></table></div> : <div className={`admin-record-grid ${tab === "patrocinadores" ? "admin-ally-list" : ""} ${tab === "galeria" || tab === "noticias" ? "admin-content-cards" : ""} ${tab === "carreras" ? "admin-race-cards" : ""}`}>
          {filteredRecords.map((record, index) => {
            const media = record.media_url ?? record.url ?? record.imagen ?? record.logo;
            if (tab === "patrocinadores") return <article className="admin-ally-row" key={record._id}>
              <img src={assetUrl(media, "/images/logo-miranda-runners.svg")} alt="" onError={(event) => { event.currentTarget.src = "/images/logo-miranda-runners.svg"; }} />
              <div className="admin-ally-details"><strong>{String(record.nombre ?? "Marca aliada")}</strong><span>{String(record.enlace ?? "")}</span></div>
              <RecordActions record={record} onEdit={() => updateField(tab, record)} onDelete={() => mutateCollection(tab, "delete", { id: record._id })} />
            </article>;
            return <article className={`admin-record-card ${tab === "galeria" ? "admin-gallery-record" : ""}`} key={record._id}>
            {typeof media === "string" && <div className="admin-record-media">{socialMediaPlatform(media) ? <SocialVideoFrame sourceUrl={media} title={String(record.titulo ?? "Video Runners X")} className="admin-record-social-video" /> : record.media_type === "video" || isVideoFileUrl(media) ? <video src={assetUrl(media)} controls preload="metadata" /> : <img src={assetUrl(media, "/images/logo-miranda-runners.svg")} alt="" onError={(event) => { event.currentTarget.src = "/images/logo-miranda-runners.svg"; }} />}{(record.media_type === "video" || isVideoFileUrl(media) || socialMediaPlatform(media)) && <span>VIDEO</span>}</div>}
            <div className="admin-record-body"><div className="admin-record-title"><h2>{String(record.titulo ?? record.nombre ?? record.distancia ?? record._id)}</h2>{record.activa === false && <span className="admin-badge">Inactiva</span>}</div>
              <p>{String(tab === "galeria" ? record.subtitulo ?? "" : record.descripcion ?? record.resumen ?? record.terreno ?? record.fecha ?? "")}</p>
              <div className="admin-record-actions">
                {(tab === "hero" || tab === "galeria" || tab === "noticias") && <span className="admin-type-pill">{String(record.media_type ?? "imagen")}</span>}
                <RecordActions record={record} onEdit={() => updateField(tab, record)} onDelete={() => mutateCollection(tab, "delete", { id: record._id })} />
                {tab === "hero" && <div className="admin-order-actions"><button title="Mover arriba" type="button" onClick={() => changeOrder(tab, record._id, "up")} disabled={index === 0 || busy}><i className="fa-solid fa-arrow-up" /></button><button title="Mover abajo" type="button" onClick={() => changeOrder(tab, record._id, "down")} disabled={index === filteredRecords.length - 1 || busy}><i className="fa-solid fa-arrow-down" /></button></div>}
              </div>
            </div>
          </article>;
          })}
          {!filteredRecords.length && <div className="admin-empty-card">No hay contenido todavía. Usa «Añadir» para empezar.</div>}
        </div>}
      </section>}

      {tab === "inscripciones" && <section className="admin-content-panel">
        <div className="admin-section-heading"><div><span className="admin-kicker">PARTICIPANTES</span><h1>Inscripciones</h1><p>{registrations.length} registros recibidos</p></div><div className="admin-export-actions"><button className="admin-outline-button admin-action-button" type="button" disabled={!registrations.length} onClick={() => downloadCsv("inscripciones-runners-x.csv", registrations)}><i className="fa-solid fa-file-csv" /> Exportar CSV</button><button className="admin-outline-button admin-action-button" type="button" disabled={!registrations.length} onClick={() => { if (printRegistrationsPdf(registrations)) setNotice({ ok: true, text: "Vista de impresión abierta. Selecciona «Guardar como PDF» para descargar el archivo." }); else setNotice({ ok: false, text: "El navegador bloqueó la ventana de impresión. Permite ventanas emergentes e inténtalo otra vez." }); }}><i className="fa-solid fa-file-pdf" /> Exportar PDF</button></div></div>
        <div className="admin-table-scroll"><table className="admin-record-table admin-registration-table"><colgroup><col className="col-participant" /><col className="col-race" /><col className="col-contact" /><col className="col-date" /><col className="col-status" /><col className="col-actions" /></colgroup><thead><tr><th>Participante</th><th>Carrera</th><th>Contacto</th><th>Fecha</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
          {registrations.map((item) => <tr key={item._id}><td><strong>{String(item.nombre ?? item.nombre_completo ?? "Sin nombre")}</strong><small>{String(item.documento ?? item.cedula ?? "")}</small></td><td>{String(item.carrera ?? item.distancia ?? "")}</td><td>{String(item.email ?? item.correo ?? "")}<small>{String(item.telefono ?? "")}</small></td><td>{formatAdminDate(item.fecha_registro ?? item.fecha ?? item.created_at)}</td><td><span className={`admin-status ${item.estado === "Confirmado" ? "confirmed" : ""}`}>{String(item.estado ?? "Pendiente")}</span></td><td><div className="admin-row-actions admin-registration-actions"><select aria-label={`Estado de inscripción de ${String(item.nombre ?? "participante")}`} value={String(item.estado ?? "Pendiente")} onChange={(event) => void mutateRegistration(item._id, "update", event.target.value)}><option>Pendiente</option><option>Confirmado</option></select><button type="button" className="admin-icon-button danger" onClick={() => void mutateRegistration(item._id, "delete")} aria-label="Eliminar inscripción"><i className="fa-solid fa-trash" /></button></div></td></tr>)}
          {!registrations.length && <tr><td colSpan={6} className="admin-empty">Aún no hay inscripciones recibidas.</td></tr>}
        </tbody></table></div>
      </section>}

      {tab === "configuracion" && <section className="admin-content-panel">
        <div className="admin-section-heading"><div><span className="admin-kicker">IDENTIDAD DEL SITIO</span><h1>Configuración</h1><p>Datos de contacto, redes, marca y pie del portal.</p></div></div>
        <form className="admin-card admin-config-form" onSubmit={saveConfig}>
          <div className="admin-form-grid">{[...Object.entries(config).filter(([key]) => key !== "logo" && (key !== "modo_demo" || session.role !== "demo")), ["logo", config.logo ?? ""]].map(([key, value]) => <label key={key} className={key === "logo" ? "admin-config-logo-field" : undefined}>{key === "logo" ? "Logo del sitio" : key.replaceAll("_", " ")}{key === "logo" ? <MediaInput name={key} value={value} purpose="site-logo" disabled={busy} onChange={(next) => setConfig((current) => ({ ...current, [key]: next }))} onUpload={uploadMedia} /> : <input className="admin-input" value={value} onChange={(event) => setConfig((current) => ({ ...current, [key]: event.target.value }))} placeholder={`Escribe ${key.replaceAll("_", " ")}`} />}</label>)}</div>
          <div className="admin-add-config"><input className="admin-input" id="new-config-key" placeholder="Nombre del nuevo dato (ej. youtube)" /><button type="button" className="admin-outline-button" onClick={() => { const input = document.getElementById("new-config-key") as HTMLInputElement | null; const key = input?.value.trim().toLowerCase().replaceAll(" ", "_"); if (input && key && !Object.hasOwn(config, key)) { setConfig((current) => ({ ...current, [key]: "" })); input.value = ""; } }}>Añadir campo</button></div>
          <button type="submit" className="btn-primary" disabled={busy}>{busy ? "Guardando…" : "Guardar configuración"}</button>
        </form>
        {session.role === "owner" && <section className="admin-card admin-users-panel">
          <div className="admin-section-heading compact"><div><span className="admin-kicker">ACCESOS</span><h2>Cuentas de administrador</h2></div><button type="button" className="admin-outline-button" onClick={() => setAdminEditor(null)}><i className="fa-solid fa-plus" /> Nueva cuenta</button></div>
          <div className="admin-user-management-grid">
            <form key={adminEditor?._id ?? "new-admin"} className="admin-user-form" onSubmit={saveAdmin}>
              <h3>{adminEditor ? "Editar cuenta" : "Crear administrador"}</h3>
              <label>Usuario<input className="admin-input" name="username" required minLength={3} maxLength={32} defaultValue={String(adminEditor?.username ?? "")} placeholder="Nombre de usuario" /></label>
              <label>Correo electrónico<input className="admin-input" name="email" type="email" required defaultValue={String(adminEditor?.email ?? "")} placeholder="nombre@ejemplo.com" /></label>
              <label>{adminEditor ? "Nueva contraseña (opcional)" : "Contraseña"}<input className="admin-input" name="password" type="password" minLength={12} autoComplete="new-password" required={!adminEditor} placeholder={adminEditor ? "Déjala vacía para conservarla" : "Crea una contraseña segura"} /></label>
              <button type="submit" className="btn-primary" disabled={busy}>{adminEditor ? "Guardar cuenta" : "Crear cuenta"}</button>
            </form>
            <div className="admin-user-list">{admins.map((user) => <article className="admin-user-item" key={user._id}><div className="admin-user-identity"><strong>{String(user.username)}</strong><small>{String(user.email)}</small><span>{user.role === "owner" ? "Propietario" : "Administrador"}</span></div><div className="admin-user-actions"><button className="admin-icon-button" type="button" onClick={() => setAdminEditor(user)} aria-label="Editar cuenta"><i className="fa-solid fa-pen" /></button>{user.role !== "owner" && <button className="admin-icon-button danger" type="button" onClick={() => void removeAdmin(user._id)} aria-label="Eliminar cuenta"><i className="fa-solid fa-trash" /></button>}</div></article>)}{!admins.length && <p>No hay cuentas registradas.</p>}</div>
          </div>
        </section>}
      </section>}
    </div>

    {dialog && <RecordDialog key={`${dialog.collection}-${dialog.record?._id ?? "new"}`} collection={dialog.collection} record={dialog.record} fields={resources[dialog.collection].fields} busy={busy} onClose={() => setDialog(null)} onSubmit={saveRecord} onUpload={uploadMedia} />}
  </main>;
}

function RecordActions({ record, onEdit, onDelete }: { record: DataRecord; onEdit: () => void; onDelete: () => void }) {
  return <div className="admin-row-actions">
    <button className="admin-icon-button" type="button" aria-label={`Editar ${String(record.titulo ?? record.nombre ?? "registro")}`} onClick={onEdit}><i className="fa-solid fa-pen" /><span>Editar</span></button>
    <button className="admin-icon-button danger" type="button" aria-label="Eliminar registro" onClick={() => { if (window.confirm("¿Eliminar este contenido? Esta acción no se puede deshacer.")) onDelete(); }}><i className="fa-solid fa-trash" /><span>Eliminar</span></button>
  </div>;
}

function RecordDialog({ collection, record, fields, busy, onClose, onSubmit, onUpload }: {
  collection: string; record?: DataRecord; fields: Field[]; busy: boolean;
  onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUpload: (file: File, purpose: string) => Promise<string>;
}) {
  const [mediaType, setMediaType] = useState(String(record?.media_type ?? "imagen"));
  function renderField(field: Field) {
    const value = record?.[field.key];
    const options = field.options?.map((option) => <option value={option} key={option}>{option === "registration" ? "Abrir inscripción" : option === "link" ? "Abrir enlace" : option === "imagen" ? "Imagen" : option === "video" ? "Video" : option}</option>);
    const placeholder = field.key.endsWith("_url") || field.key === "enlace"
      ? "https://ejemplo.com"
      : `Escribe ${field.label.toLowerCase()}`;
    return <label className={field.type === "textarea" || field.type === "media" ? "wide" : ""} key={field.key}>
      <span>{field.label}</span>
      {field.type === "textarea" ? <textarea className="admin-input" name={field.key} rows={3} defaultValue={String(value ?? "")} placeholder={placeholder} /> :
        field.type === "select" ? field.key === "media_type" ? <select className="admin-input" name={field.key} value={mediaType} onChange={(event) => setMediaType(event.target.value)}><option value="" disabled hidden>{field.label}</option>{options}</select> : <select className="admin-input" name={field.key} defaultValue={String(value ?? field.options?.[0] ?? "")}><option value="" disabled hidden>{field.label}</option>{options}</select> :
        field.type === "checkbox" ? <span className="admin-checkbox-row"><input type="checkbox" name={field.key} defaultChecked={value === undefined ? field.key === "activa" : Boolean(value)} /> Sí</span> :
        field.type === "media" ? <MediaInput name={field.key} value={String(value ?? "")} purpose={field.purpose ?? collection} disabled={busy} onChange={() => {}} onMediaTypeChange={field.purpose === "gallery" || field.purpose === "hero" || field.purpose === "news" ? setMediaType : undefined} onUpload={onUpload} /> :
        <input className="admin-input" name={field.key} type={field.type === "datetime" ? "datetime-local" : field.type ?? "text"} step={field.type === "number" ? "any" : undefined} defaultValue={field.type === "datetime" && value ? toDateTimeLocal(String(value)) : String(value ?? "")} placeholder={field.type === "datetime" ? undefined : field.type === "number" ? "Ej.: 12" : placeholder} />}
      {field.hint && <small className="admin-field-hint">{field.hint}</small>}
    </label>;
  }
  const groupedFields = (group: Field["group"]) => fields.filter((field) => field.group === group);
  return <div className="admin-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className={`admin-dialog ${collection === "hero" ? "admin-dialog-hero" : ""}`} role="dialog" aria-modal="true" aria-labelledby="admin-dialog-title">
      <header className="admin-dialog-header"><div><span className="admin-kicker">{resources[collection].label}</span><h2 id="admin-dialog-title">{record ? "Editar contenido" : "Añadir contenido"}</h2></div><button type="button" className="admin-icon-button" onClick={onClose} aria-label="Cerrar"><i className="fa-solid fa-xmark" /></button></header>
      <form className="admin-dialog-form" onSubmit={onSubmit}>
        <div className="admin-form-grid">{fields.filter((field) => !field.group).map(renderField)}</div>
        {groupedFields("primary").length > 0 && <fieldset className="admin-button-config"><legend>Botón primario</legend><div className="admin-form-grid">{groupedFields("primary").map(renderField)}</div></fieldset>}
        {groupedFields("secondary").length > 0 && <fieldset className="admin-button-config"><legend>Botón secundario</legend><div className="admin-form-grid">{groupedFields("secondary").map(renderField)}</div></fieldset>}
        <footer className="admin-dialog-footer"><button type="button" className="admin-outline-button" onClick={onClose}>Cancelar</button><button type="submit" className="btn-primary" disabled={busy}>{busy ? "Guardando…" : "Guardar"}</button></footer>
      </form>
    </section>
  </div>;
}

function toDateTimeLocal(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function MediaInput({ name, value, purpose, disabled, onChange, onUpload, onMediaTypeChange }: {
  name: string; value: string; purpose: string; disabled: boolean;
  onChange: (value: string) => void; onUpload: (file: File, purpose: string) => Promise<string>;
  onMediaTypeChange?: (type: "imagen" | "video") => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [mediaValue, setMediaValue] = useState(value);
  const [previewError, setPreviewError] = useState(false);
  const isSiteLogo = purpose === "site-logo";
  const mediaPlatform = socialMediaPlatform(mediaValue);
  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const url = await onUpload(file, purpose);
      setMediaValue(url);
      setPreviewError(false);
      onChange(url);
      onMediaTypeChange?.(file.type.startsWith("video/") ? "video" : "imagen");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo subir el archivo.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }
  return <div className="admin-media-input">
    <div className="admin-media-url"><input className="admin-input" name={name} value={mediaValue} onChange={(event) => { const nextValue = event.target.value; setMediaValue(nextValue); setPreviewError(false); onChange(nextValue); onMediaTypeChange?.(socialMediaPlatform(nextValue) || isVideoFileUrl(nextValue) ? "video" : "imagen"); }} placeholder={isSiteLogo ? "Pega la URL o carga el logo" : "Pega URL de imagen/video (YouTube, Instagram, TikTok, Vimeo y otras redes) o sube archivo"} /><label className={`admin-file-button ${disabled || uploading ? "disabled" : ""}`} aria-label={uploading ? "Subiendo archivo" : isSiteLogo ? "Cargar logo" : "Subir imagen o video"} title={uploading ? "Subiendo archivo" : isSiteLogo ? "Seleccionar logo" : "Seleccionar imagen o video"}><i className={`fa-solid ${uploading ? "fa-spinner fa-spin" : "fa-arrow-up-from-bracket"}`} /><input type="file" accept={isSiteLogo ? "image/jpeg,image/png,image/webp" : "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"} disabled={disabled || uploading} onChange={selectFile} /></label></div>
    {error && <small className="admin-field-error">{error}</small>}
    {isSiteLogo ? <div className="admin-site-logo-preview">
      {previewError ? <span className="admin-field-error">No se pudo cargar la vista previa del logo. Revisa la URL o vuelve a cargar el archivo.</span> : <img src={assetUrl(mediaValue, "/images/logo-miranda-runners.svg")} alt="Vista previa del logo del sitio" onError={() => setPreviewError(true)} />}
      <small>Recomendado: PNG o WebP transparente, 600 × 200 px (proporción 3:1), máximo 3 MB. El mismo logo se adapta automáticamente a escritorio y móvil.</small>
    </div> : mediaPlatform && <SocialVideoFrame sourceUrl={mediaValue} title={`Vista previa de video en ${mediaPlatform}`} className="admin-media-preview-frame" />}
  </div>;
}

function formatAdminDate(value: unknown): string {
  if (typeof value !== "string" || !value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("es-VE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}
