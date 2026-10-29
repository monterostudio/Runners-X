# Manual del administrador

## Acceder al panel

El panel se abre en `https://<dominio-publicado>/admin`. Vercel debe tener configuradas las variables de Supabase antes de habilitar una demo administrativa compartida.

## Preparar el primer acceso

1. Confirma que el proyecto Supabase tiene aplicado [`../supabase/schema.sql`](../supabase/schema.sql) y que las variables obligatorias están configuradas en Vercel.
2. Añade `ADMIN_SETUP_KEY` como variable privada en Vercel y realiza un despliegue.
3. Abre `/admin` y crea el propietario. Usa una contraseña segura de al menos 12 caracteres.
4. Guarda el usuario y la contraseña en el gestor aprobado por el cliente.
5. Elimina `ADMIN_SETUP_KEY` de Vercel y vuelve a desplegar.
6. Inicia sesión y crea una cuenta individual para cada administrador. No compartas la cuenta del propietario.

## Secciones del panel

- **Resumen:** accesos rápidos y recuentos generales.
- **Carreras:** gestiona distancias, terreno, altitud y periodos de apertura/cierre.
- **Diapositivas:** actualiza textos, imágenes/videos, botones y orden de la portada.
- **Galería:** publica imágenes y videos con título y descripción.
- **Noticias:** administra título, fecha, autor, resumen, contenido y medio.
- **Resultados:** gestiona clasificaciones e importa/exporta CSV.
- **Marcas aliadas:** administra nombre, imagen y enlace.
- **Inscripciones:** revisa participantes, cambia el estado y exporta CSV o PDF.
- **Configuración:** actualiza contacto, redes, marca e información del pie.
- **Cuentas:** el propietario crea, edita y elimina cuentas administrativas.

## Inscripciones en modo demo

Si `modo_demo` está activo, las inscripciones de prueba se guardan en la tabla Supabase `demo_registrations`, separada de `registrations`. Usa exclusivamente información ficticia y elimina los registros de demostración al cerrar la presentación. No cambies el modo demo hasta que el cliente apruebe los datos y el flujo real.

## Importar resultados

La importación **reemplaza todos los resultados actuales**; exporta una copia antes de continuar. El archivo debe ser CSV de hasta 2 MB, con encabezados equivalentes a `Posición, Nombre, Dorsal, Distancia, Categoría, Tiempo, Ritmo`. El importador admite coma o punto y coma y hasta 20.000 filas.

## Medios y publicación

Las imágenes y videos existentes son enlaces externos ilustrativos. Antes de publicar contenido del cliente, confirma autorización, disponibilidad, atribución y derechos de uso.

Para cargas nuevas, se usa el bucket público `runnersx-media` de Supabase Storage. Límites: imágenes 8 MB, logo 3 MB y videos MP4/WebM 50 MB. No almacenes documentos, inscripciones ni información personal en ese bucket.

## Protección de datos y operación

Las inscripciones pueden contener datos personales y contactos de emergencia. Limita el acceso a personal autorizado; exporta solo cuando sea necesario y elimina las copias descargadas cuando ya no se requieran. Nunca envíes credenciales ni CSV con información personal por canales públicos.

Ante errores de despliegue o persistencia, revisa los registros privados de Vercel y Supabase. No publiques registros que contengan tokens, cookies, datos de participantes o secretos.
