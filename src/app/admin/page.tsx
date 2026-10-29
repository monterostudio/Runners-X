import { AdminConsole } from "@/components/admin-console";
import { getAdminSession } from "@/lib/admin-auth";
import { getAdmins, getCollection, getRegistrations, getSiteConfig, type DataRecord } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/supabase-admin";

export default async function AdminPage() {
  const [session, admins, config] = await Promise.all([getAdminSession(), getAdmins(), getSiteConfig()]);
  const demoMode = config.modo_demo === "true";
  const localDemo = !isSupabaseConfigured();
  if (!session) return <AdminConsole initialSession={null} setupRequired={admins.length === 0} demoMode={demoMode} localDemo={localDemo} />;

  const [races, slides, gallery, news, sponsors, results, registrations] = await Promise.all([
    getCollection("carreras"),
    getCollection("hero"),
    getCollection("galeria"),
    getCollection("noticias"),
    getCollection("patrocinadores"),
    getCollection("resultados"),
    getRegistrations(),
  ]);
  const safeAdmins = session.role === "owner" ? admins.map((admin) => {
    const safeAdmin = { ...admin };
    delete safeAdmin.password_hash;
    return safeAdmin;
  }) : [];
  const initialData: Record<string, DataRecord[]> = {
    carreras: races,
    hero: slides,
    galeria: gallery,
    noticias: news,
    patrocinadores: sponsors,
    resultados: results,
  };
  return <AdminConsole initialSession={session} setupRequired={false} demoMode={demoMode} localDemo={localDemo} initialData={initialData} initialRegistrations={registrations} initialConfig={config} initialAdmins={safeAdmins} />;
}
