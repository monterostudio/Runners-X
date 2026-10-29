import { GalleryGrid, PublicShell } from "@/components/site";
import { getCollection, getSiteConfig } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  const [config, races, items] = await Promise.all([getSiteConfig(), getCollection("carreras"), getCollection("galeria")]);
  return <PublicShell config={config} races={races}>
    <main className="page-container">
      <div className="page-header"><div className="container"><span className="hero-tagline">MEMORIAS DE MONTAÑA</span><h1 className="page-title">GALERÍA <span className="highlight">MULTIMEDIA</span></h1><p className="page-subtitle">{config.modo_demo === "true" ? "Imágenes de stock y videos externos de referencia; no son material de una carrera real." : "Fotos y videos de Runners X."}</p></div></div>
      <section className="gallery-section container"><GalleryGrid items={items} /></section>
    </main>
  </PublicShell>;
}
