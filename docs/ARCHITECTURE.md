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

## Principios

La arquitectura debe mantenerse deliberadamente simple durante V1.

Evitar agregar dependencias o abstracciones que no sean necesarias para cumplir el alcance definido en PRODUCT.md.

La estructura debe permitir evolución futura sin implementar anticipadamente funcionalidades posteriores.