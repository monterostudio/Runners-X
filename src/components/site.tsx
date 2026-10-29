"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { DataRecord, SiteConfig } from "@/lib/data";
import { assetUrl, publicHref } from "@/lib/public-links";
import { isVideoFileUrl, mediaSourceUrl, socialMediaPlatform, socialVideoEmbedUrl } from "@/lib/media-embed";

type Race = DataRecord;

function raceStatus(race: Race, now = Date.now()): string {
  if (race.activa === false) return "inactiva";
  const opens = typeof race.apertura === "string" && race.apertura ? Date.parse(race.apertura) : null;
  const closes = typeof race.cierre === "string" && race.cierre ? Date.parse(race.cierre) : null;
  if ((opens !== null && !Number.isFinite(opens)) || (closes !== null && !Number.isFinite(closes))) return "cerrada";
  if (opens !== null && now < opens) return "proxima";
  if (closes !== null && now >= closes) return "cerrada";
  return "abierta";
}

function raceLabel(status: string): string {
  return ({ abierta: "Abierta", proxima: "Próximamente", cerrada: "Cerrada", inactiva: "No disponible" })[status] || "No disponible";
}

function formatRaceDate(value: unknown, fallback: string): string {
  if (typeof value !== "string" || !value) return fallback;
  const date = new Date(value.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? "Fecha no válida" : new Intl.DateTimeFormat("es-VE", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export function SiteHeader({ config, onRegister }: { config: SiteConfig; onRegister: (raceId?: string) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const logo = assetUrl(config.logo, "/images/logo-miranda-runners.svg");
  const demoMode = config.modo_demo === "true";
  return (
    <>
      <div className="topbar-miranda">
        <div className="container topbar-container">
          <div className="topbar-row topbar-row-mobile">
            <div className="topbar-info">
              {demoMode ? <span className="topbar-item"><i className="fa-brands fa-whatsapp topbar-icon-wa" /> {config.telefono || "Contacto de demostración"}</span> : <a href={`https://wa.me/${config.telefono_link || "584140000000"}`} target="_blank" rel="noopener noreferrer" className="topbar-item">
                <i className="fa-brands fa-whatsapp topbar-icon-wa" /> {config.telefono || "(+58) 414 000 0000"}
              </a>}
              {demoMode ? <span className="topbar-item"><i className="fa-solid fa-envelope" /> {config.email || "Correo de demostración"}</span> : <a href={`mailto:${config.email || "info@mirandarunners.com"}`} className="topbar-item">
                <i className="fa-solid fa-envelope" /> {config.email || "info@mirandarunners.com"}
              </a>}
            </div>
            <div className="topbar-row-col">
              <span className="topbar-location"><i className="fa-solid fa-location-dot" /> {config.ubicacion || "Estado Miranda, Venezuela"}</span>
            </div>
          </div>
          <div className="topbar-socials">
            {[
              ["instagram", "fa-instagram"], ["facebook", "fa-facebook-f"], ["strava", "fa-strava"], ["tiktok", "fa-tiktok"],
            ].map(([name, icon]) => config[name] && (
              <a key={name} href={publicHref(config[name])} target="_blank" rel="noopener noreferrer" title={name}>
                <i className={`fa-brands ${icon}`} />
              </a>
            ))}
          </div>
        </div>
      </div>
      <header className="main-header" id="mainHeader">
        <div className="header-container container">
          <Link href="/" className="brand-logo-miranda" title="Runners X - Inicio">
            <img src={logo} alt="Runners X" className="logo-img-miranda" />
          </Link>
          <button type="button" className={`nav-toggle ${menuOpen ? "toggle-active" : ""}`} aria-label={menuOpen ? "Cerrar menú" : "Abrir menú de navegación"} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
            <span className="bar" /><span className="bar" /><span className="bar" />
          </button>
          <nav className={`main-nav ${menuOpen ? "nav-active" : ""}`} id="mainNav">
            <ul className="nav-list" onClick={() => setMenuOpen(false)}>
              <li><Link href="/" className="nav-link">Inicio</Link></li>
              <li><Link href="/resultados" className="nav-link">Resultados</Link></li>
              <li><Link href="/galeria" className="nav-link">Galería</Link></li>
              <li><Link href="/noticias" className="nav-link">Noticias</Link></li>
              <li><button type="button" className="btn-cta-nav" onClick={() => onRegister()}><i className="fa-solid fa-person-running" /> Inscríbete</button></li>
            </ul>
          </nav>
        </div>
      </header>
    </>
  );
}

export function SiteFooter({ config, races, children }: { config: SiteConfig; races: Race[]; children?: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [raceId, setRaceId] = useState("");
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const [sending, setSending] = useState(false);
  const logo = assetUrl(config.logo, "/images/logo-miranda-runners.svg");
  const demoMode = config.modo_demo === "true";
  const openRegistration = useCallback((id = "") => {
    const firstOpen = races.find((race) => raceStatus(race) === "abierta");
    setRaceId(id || String(firstOpen?.id ?? firstOpen?._id ?? ""));
    setNotice(null);
    setIsOpen(true);
    document.body.style.overflow = "hidden";
  }, [races]);
  const closeRegistration = () => {
    setIsOpen(false);
    document.body.style.overflow = "";
  };

  useEffect(() => {
    const open = (event: Event) => openRegistration((event as CustomEvent<string>).detail || "");
    window.addEventListener("runnersx:register", open);
    return () => window.removeEventListener("runnersx:register", open);
  }, [openRegistration]);

  async function submitRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setSending(true);
    setNotice(null);
    const values = Object.fromEntries(new FormData(form).entries());
    try {
      const response = await fetch("/api/registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo enviar la inscripción.");
      setNotice({ ok: true, message: `${result.message} Código: ${result.id}` });
      form.reset();
    } catch (error) {
      setNotice({ ok: false, message: error instanceof Error ? error.message : "Error al conectar con el servidor." });
    } finally {
      setSending(false);
    }
  }

  const openRaces = races.filter((race) => raceStatus(race) === "abierta");

  return (
    <>
      {children}
      <footer className="main-footer">
        <div className="container footer-grid">
          <div className="footer-col brand-col">
            <Link href="/" className="brand-logo-miranda" style={{ maxWidth: 240, marginBottom: "1rem" }}>
              <img src={logo} alt="Runners X" className="logo-img-miranda" />
            </Link>
            <p className="footer-desc">{config.footer_descripcion || "Comunidad y circuito oficial de corredores de Miranda. Promoviendo la salud, el alto rendimiento y la pasión por el asfalto y la montaña."}</p>
            <div className="footer-socials">
              {[
                ["instagram", "fa-instagram"], ["facebook", "fa-facebook-f"], ["strava", "fa-strava"], ["tiktok", "fa-tiktok"],
              ].map(([name, icon]) => config[name] && <a key={name} href={publicHref(config[name])} target="_blank" rel="noopener noreferrer" className="social-link" aria-label={name}><i className={`fa-brands ${icon}`} /></a>)}
            </div>
          </div>
          <div className="footer-col">
            <h4 className="footer-title">Enlaces</h4>
            <ul className="footer-links">
              <li><Link href="/">Inicio</Link></li><li><Link href="/resultados">Resultados y tiempos</Link></li>
              <li><Link href="/galeria">Galería fotográfica</Link></li><li><Link href="/noticias">Noticias y artículos</Link></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4 className="footer-title">Contacto y logística</h4>
            <div className="footer-contact-grid">
              <div className="footer-contact-item">
                <div className="footer-contact-label"><i className="fa-solid fa-location-dot" /><strong>Sede</strong></div>
                <span>{config.ubicacion || "Estado Miranda, Venezuela"}</span>
              </div>
              <div className="footer-contact-item">
                <div className="footer-contact-label"><i className="fa-brands fa-whatsapp" /><strong>WhatsApp</strong></div>
                <span>{config.telefono || "+58 414 000 0000"}</span>
              </div>
              <div className="footer-contact-item">
                <div className="footer-contact-label"><i className="fa-solid fa-envelope" /><strong>Email</strong></div>
                <span>{demoMode ? config.email || "Correo de demostración" : <a href={`mailto:${config.email || "info@mirandarunners.com"}`}>{config.email || "info@mirandarunners.com"}</a>}</span>
              </div>
              <div className="footer-contact-item">
                <div className="footer-contact-label"><i className="fa-solid fa-stopwatch-20" /><strong>Cronometraje</strong></div>
                <span>{config.cronometraje_info || "Sistema certificado con chip electrónico"}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="footer-bottom"><div className="container bottom-flex"><p className="footer-copyright"><span>© {new Date().getFullYear()} <strong>RUNNERS X</strong></span>{" "}<span>Todos los derechos reservados.</span></p><p className="legales">Pasión • Salud • Rendimiento</p></div></div>
      </footer>
      <div className={`registration-modal-overlay ${isOpen ? "modal-show" : ""}`} id="registrationModal" aria-hidden={!isOpen} onMouseDown={(event) => { if (event.target === event.currentTarget) closeRegistration(); }}>
        <div className="registration-modal-box" role="dialog" aria-modal="true" aria-labelledby="registration-title">
          <button type="button" className="modal-close-btn" onClick={closeRegistration} aria-label="Cerrar">×</button>
          <div className="modal-header-branding">
            <img src={logo} alt="Runners X" className="modal-logo-img" />
            <h3 className="modal-title" id="registration-title">{demoMode ? "INSCRIPCIÓN DE DEMOSTRACIÓN" : "FICHA OFICIAL DE INSCRIPCIÓN"}</h3>
            <p className="modal-subtitle">{demoMode ? "Formulario de prueba. Usa datos ficticios; no ingreses datos personales." : "Completa tus datos para inscribirte."}</p>
            <div className="registration-race-details" hidden={!raceId}><strong>{String(races.find((race) => String(race.id ?? race._id) === raceId)?.nombre ?? "")}</strong></div>
          </div>
          {notice && <div className={`alert-box ${notice.ok ? "alert-success" : "alert-error"}`} role="status">{notice.message}</div>}
          <form onSubmit={submitRegistration}>
            <div className="form-row">
              <div className="form-group"><label htmlFor="registration-name">Nombre y apellido *</label><input id="registration-name" name="nombre" className="admin-input" placeholder="Nombre y apellido" minLength={2} maxLength={120} required /></div>
              <div className="form-group"><label htmlFor="registration-document">Cédula / documento *</label><input id="registration-document" name="documento" className="admin-input" placeholder="Documento de identidad" minLength={3} maxLength={40} required /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label htmlFor="registration-email">Correo electrónico *</label><input id="registration-email" name="email" type="email" className="admin-input" placeholder="Correo electrónico" required /></div>
              <div className="form-group"><label htmlFor="registration-phone">Teléfono / WhatsApp *</label><input id="registration-phone" name="telefono" type="tel" className="admin-input" placeholder="Teléfono / WhatsApp" required /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label htmlFor="registration-race">Distancia a participar *</label><select id="registration-race" name="carrera_id" className="admin-input" value={raceId} onChange={(event) => setRaceId(event.target.value)} required><option value="" disabled>Selecciona una distancia</option>{races.map((race) => { const id = String(race.id ?? race._id); const status = raceStatus(race); return <option key={id} value={id} disabled={status !== "abierta"}>{String(race.distancia ?? "")} · {String(race.nombre ?? "")}{status !== "abierta" ? ` · ${raceLabel(status)}` : ""}</option>; })}</select></div>
              <div className="form-group"><label htmlFor="registration-shirt">Talla de camiseta *</label><select id="registration-shirt" name="talla" className="admin-input" defaultValue="M" required>{["XS", "S", "M", "L", "XL"].map((size) => <option key={size} value={size}>Talla {size}</option>)}</select></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label htmlFor="registration-club">Club o equipo (opcional)</label><input id="registration-club" name="club" className="admin-input" placeholder="Club o equipo" maxLength={120} /></div>
              <div className="form-group"><label htmlFor="registration-emergency">Contacto de emergencia *</label><input id="registration-emergency" name="contacto_emergencia" className="admin-input" placeholder="Nombre y teléfono" required /></div>
            </div>
            <div className="modal-footer-actions"><button type="submit" className="btn-primary btn-block" disabled={sending || openRaces.length === 0}><i className={`fa-solid ${sending ? "fa-spinner fa-spin" : "fa-circle-check"}`} /> {sending ? "Procesando inscripción…" : openRaces.length ? demoMode ? "Enviar prueba" : "Confirmar inscripción" : "Inscripciones cerradas"}</button></div>
          </form>
        </div>
      </div>
    </>
  );
}

export function HeroCarousel({ slides, races }: { slides: DataRecord[]; races: Race[] }) {
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (slides.length < 2) return;
    const timer = window.setInterval(() => setActive((current) => (current + 1) % slides.length), 7000);
    return () => window.clearInterval(timer);
  }, [slides.length]);
  const distances = races.map((race) => race.distancia).filter(Boolean).join(", ");
  if (!slides.length) return null;
  const slide = slides[active] ?? slides[0];
  const mediaPlatform = socialMediaPlatform(slide.media_url);
  const video = slide.media_type === "video" || isVideoFileUrl(slide.media_url) || Boolean(mediaPlatform);
  const title = slide.show_distances ? distances || "Próximamente" : String(slide.titulo ?? "");
  const register = () => window.dispatchEvent(new CustomEvent("runnersx:register"));
  return (
    <section className="hero-alianza">
      <div className="hero-slider">
        <article className="hero-slide active" aria-hidden="false">
          <div className="slide-media-box">
            {mediaPlatform ? (
              <SocialVideoFrame sourceUrl={String(slide.media_url)} title={String(slide.titulo ?? "Video Runners X")} className="hero-video" />
            ) : video ? (
              <video
                key={String(slide._id)}
                src={assetUrl(slide.media_url)}
                className="hero-video"
                muted
                autoPlay
                loop
                playsInline
                preload="metadata"
              />
            ) : (
              <img
                src={assetUrl(slide.media_url)}
                alt={String(slide.etiqueta ?? title)}
                className="slide-img"
                fetchPriority="high"
              />
            )}
            {Boolean(slide.insignia) && (
              <div className="media-badge">{String(slide.insignia)}</div>
            )}
          </div>
          <div className="slide-content-box slide-content-box-video">
            <div className="slide-content-inner">
              {Boolean(slide.etiqueta) && (
                <span className="slide-tag">{String(slide.etiqueta)}</span>
              )}
              <h1 className="slide-title">{title}</h1>
              <div className="slide-bar" />
              <p className="slide-desc">{String(slide.descripcion ?? "")}</p>
              <div className="slide-actions">
                {slide.primary_action === "registration" ? (
                  <button type="button" className="btn-primary" onClick={register}>
                    {String(slide.primary_label ?? "Inscríbete")}
                  </button>
                ) : Boolean(slide.primary_url) && (
                  <Link href={publicHref(slide.primary_url)} className="btn-primary">
                    {String(slide.primary_label ?? "Ver más")}
                  </Link>
                )}
                {slide.secondary_action === "registration" ? (
                  <button type="button" className="btn-secondary" onClick={register}>
                    {String(slide.secondary_label ?? "Más información")}
                  </button>
                ) : Boolean(slide.secondary_url) && (
                  <Link href={publicHref(slide.secondary_url)} className="btn-secondary">
                    {String(slide.secondary_label ?? "Más información")}
                  </Link>
                )}
              </div>
            </div>
          </div>
        </article>
        {slides.length > 1 && (
          <>
            <button
              type="button"
              className="hero-arrow arrow-prev"
              aria-label="Anterior"
              onClick={() => setActive((active - 1 + slides.length) % slides.length)}
            >
              ❮
            </button>
            <button
              type="button"
              className="hero-arrow arrow-next"
              aria-label="Siguiente"
              onClick={() => setActive((active + 1) % slides.length)}
            >
              ❯
            </button>
            <div className="hero-dots" aria-label="Diapositivas de portada">
              {slides.map((item, index) => (
                <button
                  key={String(item._id)}
                  type="button"
                  className={`dot ${index === active ? "active" : ""}`}
                  aria-label={`Mostrar diapositiva ${index + 1}`}
                  aria-current={index === active}
                  onClick={() => setActive(index)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export function RaceCards({ races }: { races: Race[] }) {
  return <div className="races-grid">{races.map((race) => {
    const id = String(race.id ?? race._id);
    const status = raceStatus(race);
    const featured = race.distancia === "21K Trail";
    return <article key={id} className={`race-card ${featured ? "featured-race" : ""}`}>
      <div className={`race-badge ${featured ? "badge-featured" : "badge-ultra"}`}>{raceLabel(status)}</div>
      <div className="race-header"><h3 className="race-distance">{String(race.distancia ?? "").split(" ")[0]}</h3><span className="race-name">{String(race.nombre ?? "")}</span></div>
      <div className="race-specs">
        {[
          ["Distancia:", race.distancia], ["Desnivel positivo:", race.desnivel],
          ["Altitud:", `${race.altitud_minima ?? ""} – ${race.altitud_maxima ?? ""}`], ["Terreno:", race.terreno],
          ["Apertura:", formatRaceDate(race.apertura, "Inmediata")], ["Cierre:", formatRaceDate(race.cierre, "Sin fecha")],
        ].map(([label, value]) => <div className="spec-item" key={String(label)}><span className="spec-label">{String(label)}</span><span className="spec-value">{String(value ?? "")}</span></div>)}
      </div>
      <div className="race-footer">{status === "abierta" ? <button type="button" className="btn-primary btn-block" onClick={() => window.dispatchEvent(new CustomEvent("runnersx:register", { detail: id }))}>Inscribirme {String(race.distancia ?? "")}</button> : <button type="button" className="btn-secondary btn-block" disabled>{raceLabel(status)}</button>}</div>
    </article>;
  })}</div>;
}

export function NewsCards({ items, compact = false }: { items: DataRecord[]; compact?: boolean }) {
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null);
  if (!items.length) return <p className="empty-public-state">No hay noticias publicadas en este momento.</p>;
  return <div className="news-grid">{items.map((item) => {
    const id = String(item._id);
    const open = expandedArticle === id;
    const mediaPlatform = socialMediaPlatform(item.imagen);
    const video = item.media_type === "video" || isVideoFileUrl(item.imagen) || Boolean(mediaPlatform);
    return <article className="news-card" key={id}>
      <div className={`news-img-box ${video ? "news-img-box-video" : ""}`}>
        {mediaPlatform ? <SocialVideoFrame sourceUrl={String(item.imagen)} title={String(item.titulo ?? "Video Runners X")} className="news-video" /> : video ? <video src={assetUrl(item.imagen)} className="news-video" controls playsInline preload="metadata" /> : <img src={assetUrl(item.imagen, "/images/logo-miranda-runners.svg")} alt={String(item.titulo ?? "")} className="news-img" loading="lazy" />}
        <span className="news-category">{String(item.categoria ?? "Noticia")}</span>
      </div>
      <div className="news-body">
        <div className="news-meta"><span>📅 {String(item.fecha ?? "")}</span><span>⏱️ {String(item.tiempo_lectura ?? "3 min")}</span><span>✍️ {String(item.autor ?? "Equipo Runners X")}</span></div>
        <h2 className="news-title">{String(item.titulo ?? "")}</h2><p className="news-excerpt">{String(item.resumen ?? "")}</p>
        {!compact && <div className="news-full-content" id={`news-content-${id}`} hidden={!open}><p>{String(item.contenido ?? "")}</p></div>}
        {compact ? <Link href="/noticias" className="btn-read-more">Leer artículo completo</Link> : <button type="button" className="btn-read-more" aria-expanded={open} aria-controls={`news-content-${id}`} onClick={() => setExpandedArticle(open ? null : id)}>{open ? "Cerrar artículo" : "Leer artículo completo"}</button>}
      </div>
    </article>;
  })}</div>;
}

export function ResultsTable({ items }: { items: DataRecord[] }) {
  const [search, setSearch] = useState("");
  const filtered = items.filter((item) => Object.values(item).join(" ").toLowerCase().includes(search.toLowerCase().trim()));
  return <>
    <div className="table-controls"><input className="search-input" aria-label="Buscar resultados" placeholder="Buscar resultados" value={search} onChange={(event) => setSearch(event.target.value)} /><span className="records-counter">Mostrando {filtered.length} registros</span></div>
    <div className="table-responsive"><table className="results-table"><thead><tr><th>Posición</th><th>Corredor</th><th>Dorsal</th><th>Distancia</th><th>Categoría</th><th>Tiempo oficial</th><th>Ritmo medio</th></tr></thead><tbody>
      {!filtered.length ? <tr><td colSpan={7} className="empty-results">Aún no se han cargado resultados oficiales.</td></tr> : filtered.map((item) => {
        const position = Number(item.posicion ?? 0);
        const medal = position === 1 ? "pos-gold" : position === 2 ? "pos-silver" : position === 3 ? "pos-bronze" : "";
        return <tr key={String(item._id)}><td className="td-pos" data-label="Posición">{medal ? <span className={`pos-badge ${medal}`}>{position}º</span> : <span className="pos-number">{position}º</span>}</td><td className="td-name" data-label="Corredor"><strong>{String(item.nombre ?? "")}</strong></td><td className="td-dorsal" data-label="Dorsal">#{String(item.dorsal ?? "")}</td><td className="td-distance" data-label="Distancia"><span className="distance-pill">{String(item.distancia ?? "")}</span></td><td className="td-category" data-label="Categoría">{String(item.categoria ?? "")}</td><td className="td-time" data-label="Tiempo oficial">{String(item.tiempo ?? "")}</td><td className="td-pace" data-label="Ritmo medio">{String(item.ritmo ?? "")}</td></tr>;
      })}
    </tbody></table></div>
  </>;
}

export function GalleryGrid({ items }: { items: DataRecord[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    if (selected === null) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
      if (event.key === "ArrowRight") setSelected((value) => value === null ? null : (value + 1) % items.length);
      if (event.key === "ArrowLeft") setSelected((value) => value === null ? null : (value - 1 + items.length) % items.length);
    };
    window.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", handleKey); document.body.style.overflow = ""; };
  }, [selected, items.length]);
  const selectedItem = selected === null ? null : items[selected];
  return <>
    {!items.length ? <p className="empty-public-state">No hay medios publicados en este momento.</p> : <div className="gallery-grid">{items.map((item, index) => {
      const mediaPlatform = socialMediaPlatform(item.url);
      const video = item.media_type === "video" || isVideoFileUrl(item.url) || Boolean(mediaPlatform);
      return <figure className={`gallery-item ${video ? "gallery-item-video" : ""} ${mediaPlatform ? "gallery-item-embed" : ""}`} key={String(item._id)} onClick={() => { if (!video) { setSelected(index); setZoom(1); } }} onKeyDown={(event) => { if (!video && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); setSelected(index); } }} role={video ? undefined : "button"} tabIndex={video ? undefined : 0} aria-label={video ? undefined : `Ampliar imagen: ${String(item.titulo ?? "")}`}>
        {mediaPlatform ? <SocialVideoFrame sourceUrl={String(item.url)} title={String(item.titulo ?? "Video Runners X")} className="gallery-video" /> : video ? <video src={assetUrl(item.url)} className="gallery-video" controls playsInline preload="metadata" /> : <img src={assetUrl(item.url, "/images/logo-miranda-runners.svg")} alt={String(item.titulo ?? "")} className="gallery-img" loading="lazy" />}
        <figcaption className="gallery-overlay"><span className="gallery-tag">{String(item.subtitulo ?? "")}</span><h3 className="gallery-title">{String(item.titulo ?? "")}</h3><span className="gallery-zoom-hint">{video ? "▶ Reproducir video" : "🔍 Clic para ampliar"}</span></figcaption>
      </figure>;
    })}</div>}
    {selectedItem && <div className="lightbox-modal lightbox-show" onClick={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
      <div className="lightbox-topbar">
        <button className="lightbox-close" onClick={() => setSelected(null)} aria-label="Cerrar">&times;</button>
      </div>
      <button className="lightbox-nav lightbox-prev" onClick={() => { setSelected((selected! - 1 + items.length) % items.length); setZoom(1); }} aria-label="Foto anterior">❮</button>
      <button className="lightbox-nav lightbox-next" onClick={() => { setSelected((selected! + 1) % items.length); setZoom(1); }} aria-label="Siguiente foto">❯</button>
      <div className="lightbox-content"><div className="lightbox-img-wrapper">
        <img src={assetUrl(selectedItem.url, "/images/logo-miranda-runners.svg")} alt={String(selectedItem.titulo ?? "")} className="lightbox-active-img" style={{ transform: `scale(${zoom})` }} />
      </div><div className="lightbox-caption"><h3>{String(selectedItem.titulo ?? "")}</h3><span>{String(selectedItem.subtitulo ?? "")}</span><div className="lightbox-zoom-controls"><button className="zoom-btn" onClick={() => setZoom(Math.min(zoom + 0.3, 3))}>+</button><button className="zoom-btn" onClick={() => setZoom(Math.max(zoom - 0.3, 0.8))}>-</button><button className="zoom-btn" onClick={() => setZoom(1)}>1:1</button></div></div></div>
    </div>}
  </>;
}

export function PublicShell({ config, races, children }: { config: SiteConfig; races: Race[]; children: ReactNode }) {
  return <>{config.modo_demo === "true" && <div className="demo-mode-banner" role="status">DEMO · Eventos, resultados, imágenes y enlaces ilustrativos. No envíes datos personales; usa solo información ficticia.</div>}<SiteHeader config={config} onRegister={() => window.dispatchEvent(new CustomEvent("runnersx:register"))} />{children}<SiteFooter config={config} races={races} /></>;
}

export function SocialVideoFrame({ sourceUrl, title, className }: { sourceUrl: string; title: string; className: string }) {
  const embedUrl = socialVideoEmbedUrl(sourceUrl);
  const safeSourceUrl = mediaSourceUrl(sourceUrl);
  const platform = socialMediaPlatform(sourceUrl) ?? "sitio original";
  if (!safeSourceUrl) return null;

  return <div className={`social-video-frame ${className}`}>
    {embedUrl
      ? <iframe src={embedUrl} className="social-video-embed" title={title} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
      : <div className="social-video-unavailable"><i className="fa-solid fa-circle-play" /><span>Vista previa no disponible</span></div>}
    <a className="social-video-source" href={safeSourceUrl} target="_blank" rel="noopener noreferrer">
      Abrir en {platform} <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />
    </a>
  </div>;
}

export { formatRaceDate, raceLabel, raceStatus };
