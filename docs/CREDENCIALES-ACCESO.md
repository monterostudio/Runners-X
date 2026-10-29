# Gestión segura de credenciales

Este documento describe cómo provisionar accesos. **No es una bóveda** y no contiene usuarios, contraseñas, claves ni tokens. Nunca guardes credenciales reales en README, documentación, capturas, tickets ni GitHub.

## Acceso al panel

- URL: `https://<dominio-publicado>/admin`
- Cuenta propietaria: la crea el cliente durante la puesta en marcha.
- Contraseña: mínimo 12 caracteres; guárdala en el gestor de contraseñas aprobado.
- Cuenta de presentación: créala desde **Configuración → Cuentas**, comparte usuario y contraseña por un canal privado y elimínala al terminar la demostración.

No uses las credenciales generadas para desarrollo ni una contraseña compartida como acceso publicado. No hay una contraseña demo fija en el código o en GitHub.

## Variables de entorno

Configúralas en los ajustes del proyecto de Vercel. No añadas sus valores a este documento, a GitHub ni a variables con prefijo `NEXT_PUBLIC_` si son secretos.

| Variable | Clasificación | Uso |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Pública | URL del proyecto Supabase. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Pública | Clave de cliente para operaciones de Storage firmadas. |
| `SUPABASE_SERVICE_ROLE_KEY` | Secreto de servidor | Acceso del servidor a Supabase; nunca exponer en el navegador. |
| `SUPABASE_STORAGE_BUCKET` | Configuración | Bucket de medios, por defecto `runnersx-media`. |
| `ADMIN_SESSION_SECRET` | Secreto de servidor | Firma de sesiones; usa un valor aleatorio único de al menos 32 caracteres. |
| `ADMIN_SETUP_KEY` | Secreto temporal | Autoriza el registro inicial del propietario; elimínala y vuelve a desplegar después de usarla. |

## Entrega y rotación

Entrega los accesos por un gestor de contraseñas o canal seguro aprobado por el cliente. Si un secreto se publica o se comparte por error, revócalo en el proveedor, genera uno nuevo y vuelve a desplegar. No reutilices secretos entre proyectos o ambientes.
