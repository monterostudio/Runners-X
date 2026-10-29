import Link from "next/link";
import { getCollection, getSiteConfig } from "@/lib/data";
import { HeroCarousel, NewsCards, PublicShell, RaceCards } from "@/components/site";
import { assetUrl, publicHref } from "@/lib/public-links";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [config, races, slides, news, sponsors] = await Promise.all([
    getSiteConfig(),
    getCollection("carreras"),
    getCollection("hero"),
    getCollection("noticias"),
    getCollection("patrocinadores"),
  ]);
  slides.sort((a, b) => Number(a.orden ?? 0) - Number(b.orden ?? 0));

  return <PublicShell config={config} races={races}>
    <HeroCarousel slides={slides} races={races} />
    <section className="races-section" id="carreras">
      <div className="container">
        <div className="section-header"><h2 className="section-title">CIRCUITOS Y <span className="highlight">DISTANCIAS</span></h2><p className="section-subtitle">Elige tu distancia e inscríbete.</p><div className="title-bar" /></div>
        <RaceCards races={races} />
      </div>
    </section>
    <section className="races-section" style={{ backgroundColor: "var(--bg-secondary)", borderTop: "1px solid var(--border-color)" }} id="noticias-seccion">
      <div className="container">
        <div className="section-header"><h2 className="section-title">ÚLTIMAS <span className="highlight">NOTICIAS</span></h2><p className="section-subtitle">Novedades y comunicados de Runners X.</p><div className="title-bar" /></div>
        <NewsCards items={news.slice(0, 3)} compact />
        <div style={{ textAlign: "center", marginTop: "2.5rem" }}><Link href="/noticias" className="btn-secondary">Ver todas las noticias</Link></div>
      </div>
    </section>
    <section className="sponsors-section" id="patrocinadores">
      <div className="container">
        <div className="section-header"><h2 className="section-title">MARCAS <span className="highlight">ALIADAS</span></h2><p className="section-subtitle">Marcas que apoyan a Runners X.</p><div className="title-bar" /></div>
        <div className="sponsors-grid">{sponsors.length ? sponsors.map((sponsor) => <a key={String(sponsor._id)} href={publicHref(sponsor.enlace)} target="_blank" rel="noopener noreferrer" className="sponsor-card"><img src={assetUrl(sponsor.logo)} alt={String(sponsor.nombre ?? "")} className="sponsor-img-brand" /><span className="sponsor-brand-title">{String(sponsor.nombre ?? "")}</span></a>) : <p style={{ textAlign: "center", color: "var(--text-muted)", gridColumn: "1 / -1" }}>No hay marcas registradas.</p>}</div>
      </div>
    </section>
  </PublicShell>;
}
