# Despliegue en Vercel y Supabase

## Requisitos

- Proyecto Supabase del cliente.
- Repositorio GitHub con el código y los archivos permitidos.
- Proyecto Vercel conectado a ese repositorio.
- Dominio del cliente, opcional para comenzar con el dominio HTTPS asignado por Vercel.

No publiques `.env.local`, credenciales, cuentas administrativas, inscripciones ni archivos de clientes. El `.gitignore` excluye `.env*` (salvo `.env.example`), `data/administradores.json`, `data/inscripciones.json`, `data/demo-inscripciones.json` y las cargas en `uploads/` y `public/uploads/`.

## 1. Preparar Supabase

Para una presentación compartida, crea un proyecto Supabase de demostración separado. No conectes una cuenta de prueba a la base de producción ni cargues datos reales en el proyecto demo.

1. Crea el proyecto Supabase del cliente.
2. Ejecuta `supabase/schema.sql` en SQL Editor. El esquema prepara contenido, usuarios administrativos, inscripciones reales y la tabla aislada `demo_registrations`.
3. Comprueba que RLS está habilitado y que solo el servidor con `service_role` tiene permisos de acceso a las tablas.
4. El bucket `runnersx-media` es público para mostrar los medios publicados. No guardes allí documentos ni datos personales.

## 2. Configurar Vercel

Importa el repositorio de GitHub en Vercel y configura las variables en **Project → Settings → Environment Variables**. Configura los entornos que vayas a utilizar y genera secretos únicos:

| Variable | Sensibilidad | Uso |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Pública | URL del proyecto Supabase. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Pública | Clave de cliente para cargas firmadas. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secreto** | Acceso privado del servidor a la base y Storage. |
| `SUPABASE_STORAGE_BUCKET` | No secreta | `runnersx-media`, salvo que se configure otro bucket. |
| `ADMIN_SESSION_SECRET` | **Secreto** | Firma de sesiones; al menos 32 caracteres aleatorios. |
| `ADMIN_SETUP_KEY` | **Secreto temporal** | Autoriza el registro inicial del propietario; elimínala después. |

Usa `.env.example` solo como referencia de nombres, nunca como almacén de valores. No expongas `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_SESSION_SECRET` ni `ADMIN_SETUP_KEY` al cliente o al repositorio.

El build de Vercel usa `npm run build`. Después de cambiar variables, inicia un nuevo despliegue.

## 3. Revisar e importar el contenido demo

El contenido del repositorio contiene carreras y clasificaciones ficticias, marcas ilustrativas, enlaces de imágenes de stock y videos públicos externos. Antes de importar:

1. Revisa y aprueba los archivos públicos en `data/`.
2. Sustituye el contenido de muestra por datos aprobados, o confirma que debe conservarse como demo.
3. Ejecuta `npm run import:data` desde un entorno autorizado con `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` configuradas de forma privada.

El importador escribe en Supabase las colecciones públicas `carreras`, `hero`, `galeria`, `noticias`, `patrocinadores`, `resultados` y `configuracion`. No importa cuentas ni inscripciones. Este comando modifica la base remota; ejecútalo solo tras revisar el contenido y el proyecto de destino.

## 4. Crear el propietario y preparar la demo

1. Despliega con `ADMIN_SETUP_KEY` temporal configurada.
2. Abre `https://<dominio-publicado>/admin` y crea el propietario. La contraseña debe tener al menos 12 caracteres y se guarda como hash bcrypt.
3. Guarda las credenciales en el gestor aprobado por el cliente.
4. Elimina `ADMIN_SETUP_KEY` de Vercel y vuelve a desplegar.
5. Inicia sesión con la cuenta propietaria y verifica la persistencia.
6. Para una presentación, crea una cuenta administrativa individual temporal desde **Configuración → Cuentas**. Entrégala por un canal privado y elimínala cuando termine la demo.

Mantén `modo_demo` activo durante la presentación. Las inscripciones demo se guardan en `demo_registrations`, separadas de `registrations`. Usa datos completamente ficticios y elimina los registros demo al finalizar.

## 5. Dominio y HTTPS

1. Verifica primero el dominio `*.vercel.app` asignado al proyecto.
2. Si el cliente aporta un dominio, añádelo en **Project → Settings → Domains**, configura los registros DNS indicados por Vercel y espera la validación del certificado.
3. Comprueba que el sitio redirija a HTTPS y que el certificado sea válido en Chrome, Edge y Safari.
4. La aplicación añade HSTS solo en producción y otras cabeceras contra MIME sniffing, framing y filtración innecesaria del referer.

No afirmes que el dominio del cliente está certificado hasta verificarlo en el navegador después de configurar DNS.

## 6. Validación de entrega

- Ejecuta `npx tsc --noEmit`, `npm run lint` y `npm run build`.
- Revisa inicio, carreras, resultados, galería, noticias y panel en la URL publicada.
- Prueba inicio/cierre de sesión, edición de contenido, cargas, formulario de inscripción y cambio de estado.
- En modo demo, confirma que las inscripciones de prueba lleguen a `demo_registrations` y nunca a `registrations`.
- Revisa la experiencia móvil vertical y horizontal y los navegadores acordados con el cliente.
- Elimina los registros de prueba y revisa que no aparezcan datos personales en capturas.
- Confirma variables, dominio HTTPS y registros privados de Vercel/Supabase sin divulgar tokens o datos de usuarios.

Una compilación aprobada no certifica por sí sola el funcionamiento de Supabase, el dominio, Safari/iOS ni dispositivos físicos; esas comprobaciones requieren el proyecto y los equipos del cliente.

## Operación segura

No cambies manualmente `NODE_ENV`, no publiques logs con secretos y no desactives la verificación TLS. En producción, Supabase es obligatorio y las cargas de archivos no deben depender del sistema de archivos de Vercel.
