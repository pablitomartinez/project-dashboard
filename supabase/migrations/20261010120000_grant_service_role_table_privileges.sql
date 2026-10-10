-- Grant the server-side role explicit table privileges.
--
-- Some Supabase projects do not grant privileges on new tables in `public` to
-- the API roles by default, so `service_role` (used by the Next.js server with
-- the secret key) got PostgreSQL error 42501 on `public.projects`. RLS is still
-- bypassed by `service_role`; `anon` and `authenticated` keep no privileges.
-- See docs/ARCHITECTURE.md.

grant select, insert, update, delete
on table public.projects, public.tasks, public.project_resources
to service_role;
