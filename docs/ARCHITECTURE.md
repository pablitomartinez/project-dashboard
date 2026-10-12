# Project Dashboard — Architecture

## Stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- Supabase
- PostgreSQL
- Vercel

## Entidades principales

### projects

Representa un proyecto de software.

Campos conceptuales:

- id
- name
- description
- status
- progress_mode
- manual_progress
- local_path
- repository_url
- production_url
- branch
- stack
- notes
- created_at
- updated_at

Estados:

- active
- paused
- completed

Modos de progreso:

- manual
- tasks

### tasks

Representa una tarea simple perteneciente a un proyecto.

Campos conceptuales:

- id
- project_id
- title
- completed
- position
- created_at
- updated_at

Relación:

projects 1:N tasks

Cuando `progress_mode = tasks`, el progreso se calcula utilizando la cantidad de tareas completadas sobre el total.

La primera tarea pendiente según `position` representa el siguiente paso del proyecto.

### project_resources

Representa servicios y recursos relacionados con un proyecto.

Campos conceptuales:

- id
- project_id
- type
- label
- url
- account
- notes
- created_at
- updated_at

Relación:

projects 1:N project_resources

Tipos iniciales sugeridos:

- github
- supabase
- vercel
- domain
- figma
- analytics
- other

Nunca almacenar passwords, API keys, access tokens ni secretos.

## Base de datos (Supabase)

El esquema se define mediante migraciones en `supabase/migrations/`. La migración inicial es `20261001141500_initial_schema.sql`. Las migraciones ya aplicadas no se modifican: los cambios van en una migración nueva.

### Reglas del esquema

- Las claves primarias son `uuid` con `gen_random_uuid()`.
- `tasks.project_id` y `project_resources.project_id` referencian `projects.id` con `on delete cascade`: eliminar un proyecto elimina sus tareas y recursos.
- Los estados, modos de progreso y tipos de recurso usan `text` con `check` constraints en lugar de enums de Postgres, para poder modificarlos con una migración simple.
- `manual_progress` es un entero entre 0 y 100 (default 0).
- `position` de una tarea es un entero mayor o igual a 0. No es único: el orden se resuelve por `position` y, ante empate, por `created_at`.
- `name`, `title` y `label` no pueden estar vacíos ni contener solo espacios.
- Las URLs (`repository_url`, `production_url`, `project_resources.url`) son opcionales, pero si se cargan deben empezar con `http://` o `https://`.
- Las tres tablas tienen `created_at` y `updated_at` (`timestamptz`, default `now()`). El trigger `set_updated_at` actualiza `updated_at` en cada `update`.

### Índices

- `projects (status)` y `projects (updated_at desc)` para filtrar y ordenar el dashboard.
- `tasks (project_id, position)` para listar tareas ordenadas y obtener el siguiente paso.
- `project_resources (project_id)` para listar recursos de un proyecto.

### Seguridad (RLS) en V1

V1 no tiene usuarios ni autenticación. Decisión:

- RLS está habilitado en las tres tablas y no existe ninguna policy.
- Se revocan todos los privilegios de esas tablas para los roles `anon` y `authenticated`.
- Se otorgan explícitamente `select`, `insert`, `update` y `delete` sobre las tres tablas a `service_role` (migración `20261010120000_grant_service_role_table_privileges.sql`). Hay proyectos de Supabase que no otorgan estos privilegios por defecto en tablas nuevas, y sin ellos el servidor recibe el error 42501.
- Por lo tanto, la Data API de Supabase con la clave pública (anon / publishable) no puede leer ni escribir datos.
- Todo acceso a datos se hace desde código de servidor de Next.js (Server Components, Server Actions o Route Handlers) usando la clave `service_role` / secret, que omite RLS.
- La clave `service_role` / secret solo puede existir en variables de entorno del servidor (nunca con prefijo `NEXT_PUBLIC_`) y nunca se commitea.

Consecuencia: la protección de los datos depende de que la aplicación desplegada no sea pública. Antes del deploy en Vercel hay que restringir el acceso a la aplicación (por ejemplo, Vercel Deployment Protection o un login simple). Si más adelante se agrega Supabase Auth, se deberán otorgar privilegios a `authenticated` y crear policies explícitas.

### Acceso desde Next.js

- `src/lib/supabase/server.ts` crea el cliente Supabase con `SUPABASE_URL` y `SUPABASE_SECRET_KEY`. Importa `server-only`, por lo que el build falla si se importa desde un Client Component.
- `src/lib/projects.ts` (también `server-only`) contiene las consultas. Ante un error registra solo el código en el log del servidor y lanza un error genérico.
- Las variables se documentan en `.env.example`; los valores reales van en `.env.local` (ignorado por Git) o en las variables de entorno de Vercel.
- `src/lib/project-input.ts` valida los datos del formulario de proyectos. Es código puro, sin `server-only`, y se testea con `npm test` (`node --test`).
- `src/app/actions.ts` define la Server Action `createProjectAction`. Valida en el servidor y luego llama a `createProject` (`src/lib/projects.ts`), que inserta con `progress_mode = manual`. Al terminar ejecuta `revalidatePath("/")`.
- **Solo uso local.** Cualquiera que pueda acceder a la aplicación puede invocar una Server Action con un POST directo, aunque no use la interfaz. No haber login no es una protección: mientras no exista control de acceso, la aplicación solo puede ejecutarse localmente y no se debe desplegar ni exponer en una red. No hay Route Handlers.

La edición desde el dashboard reutiliza el formulario y la validación de creación.
`updateProjectAction` valida el UUID y los campos en el servidor, actualiza solo
los campos editables y revalida `/`. Conserva `progress_mode` y detecta proyectos
inexistentes. Los errores conservan los valores ingresados; al guardar se muestran
los valores guardados y una confirmación. No cambia el esquema de Supabase.

### Desarrollo local

Requiere Docker y la [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started).

- `supabase start` levanta Supabase localmente y aplica las migraciones.
- `supabase db reset` recrea la base local desde las migraciones.
- `supabase test db` ejecuta los tests pgTAP de `supabase/tests/`.
- `supabase db push` aplica las migraciones al proyecto remoto vinculado (`supabase link`).

## Principios

La arquitectura debe mantenerse deliberadamente simple durante V1.

Evitar agregar dependencias o abstracciones que no sean necesarias para cumplir el alcance definido en PRODUCT.md.

La estructura debe permitir evolución futura sin implementar anticipadamente funcionalidades posteriores.
