import { PublicShell, ResultsTable } from "@/components/site";
import { getCollection, getSiteConfig } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ResultsPage() {
  const [config, races, results] = await Promise.all([getSiteConfig(), getCollection("carreras"), getCollection("resultados")]);
  results.sort((a, b) => Number(a.posicion ?? 0) - Number(b.posicion ?? 0));
  return <PublicShell config={config} races={races}>
    <main className="page-container">
      <div className="page-header"><div className="container"><span className="hero-tagline">{config.modo_demo === "true" ? "RESULTADOS DE DEMOSTRACIÓN" : "CRONOMETRAJE OFICIAL"}</span><h1 className="page-title">RESULTADOS Y <span className="highlight">CLASIFICACIONES</span></h1><p className="page-subtitle">{config.modo_demo === "true" ? "Tiempos ficticios para mostrar el diseño; no son resultados oficiales." : "Clasificaciones oficiales de las carreras."}</p></div></div>
      <section className="results-content container"><ResultsTable items={results} /></section>
    </main>
  </PublicShell>;
}
