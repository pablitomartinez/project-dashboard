# Project Dashboard — Roadmap

## V1 — Context Dashboard

Objetivo: recuperar rápidamente el contexto necesario para continuar un proyecto.

### Foundation

- [x] Crear proyecto Next.js
- [x] Inicializar Git
- [x] Crear repositorio GitHub
- [ ] Documentar producto
- [x] Diseñar esquema Supabase
- [x] Configurar Supabase (cliente de servidor)

### Projects

- [ ] Dashboard de proyectos
  - [x] Listado de proyectos (solo lectura, ordenado por `updated_at`)
- [x] Crear proyecto (Server Action con validación en servidor; solo uso local hasta tener protección de acceso)
- [x] Editar proyecto (formulario precargado y Server Action con validación)
- [x] Eliminar proyecto (confirmación explícita; borra en cascada tareas y recursos)
- [ ] Estados active / paused / completed
- [ ] Progreso manual
- [ ] Detalle de proyecto

### Tasks

- [ ] Crear tareas
- [ ] Completar tareas
- [ ] Eliminar tareas
- [ ] Ordenar tareas
- [ ] Calcular progreso mediante tareas
- [ ] Mostrar siguiente tarea

### Project Context

- [ ] Ruta local
- [ ] Repositorio
- [ ] Producción
- [ ] Branch
- [ ] Stack
- [ ] Notas

### Resources

- [ ] Agregar recursos
- [ ] Editar recursos
- [ ] Eliminar recursos
- [ ] Registrar cuenta/correo
- [ ] Links externos

### Release

- [ ] Responsive
- [ ] Verificación final
- [ ] Deploy Vercel
- [ ] Cargar tres proyectos reales
- [ ] V1.0.0

---

## Después de V1

Ideas futuras, no implementar todavía:

- GitHub API
- estado automático del repositorio
- commits recientes
- branches y PRs
- historial de sesiones
- resumen automático para retomar trabajo
- integración con IA
- CLI
- integraciones adicionales
