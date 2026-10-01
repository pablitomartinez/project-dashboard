# Project Dashboard — Product

## Problema

Al trabajar simultáneamente en varios proyectos de software, retomar un proyecto después de varios días requiere reconstruir contexto:

- qué se estaba haciendo;
- qué está terminado;
- qué falta;
- cuál es el siguiente paso;
- dónde está el repositorio;
- qué branch se estaba utilizando;
- dónde está desplegado;
- qué servicios externos utiliza;
- con qué cuenta se creó cada servicio.

Actualmente esa información suele quedar distribuida entre GitHub, conversaciones con IA, archivos locales y memoria personal.

## Objetivo

Project Dashboard busca permitir recuperar en menos de un minuto el contexto necesario para continuar trabajando en cualquier proyecto.

No pretende reemplazar GitHub, Trello, Jira, Notion ni documentación técnica.

## V1

La primera versión debe permitir:

- visualizar todos los proyectos en un dashboard;
- crear, editar y eliminar proyectos;
- marcar proyectos como activos, pausados o terminados;
- registrar progreso manual o calcularlo mediante tareas;
- crear, completar y eliminar tareas;
- identificar automáticamente la primera tarea pendiente como siguiente paso;
- registrar ruta local;
- registrar repositorio;
- registrar URL de producción;
- registrar branch de trabajo;
- registrar stack;
- agregar notas;
- registrar recursos externos;
- guardar la cuenta/correo asociado a cada recurso;
- persistir la información en Supabase;
- funcionar en desktop y mobile;
- desplegarse en Vercel.

## Fuera del alcance de V1

No implementar:

- integración con GitHub API;
- IA;
- sincronización automática;
- CLI;
- equipos;
- colaboración;
- Kanban;
- notificaciones;
- subtareas;
- prioridades;
- fechas límite;
- archivos adjuntos.

## Definición de terminado

V1 se considera terminada cuando:

1. Todas las funcionalidades definidas para V1 funcionan.
2. La aplicación está desplegada en Vercel.
3. Se cargaron al menos tres proyectos reales.
4. Puede utilizarse para recuperar rápidamente el contexto de esos proyectos.

No se agregan nuevas funcionalidades antes de cumplir estos criterios.