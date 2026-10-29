import { NewsCards, PublicShell } from "@/components/site";
import { getCollection, getSiteConfig } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function NewsPage() {
  const [config, races, items] = await Promise.all([getSiteConfig(), getCollection("carreras"), getCollection("noticias")]);
  items.sort((a, b) => String(b.fecha ?? "").localeCompare(String(a.fecha ?? "")));
  return <PublicShell config={config} races={races}>
    <main className="page-container">
      <div className="page-header"><div className="container"><span className="hero-tagline">ACTUALIDAD &amp; COMUNICADOS</span><h1 className="page-title">NOTICIAS <span className="highlight">TRAIL</span></h1><p className="page-subtitle">Novedades y comunicados.</p></div></div>
      <section className="news-section container"><NewsCards items={items} /></section>
    </main>
  </PublicShell>;
}
