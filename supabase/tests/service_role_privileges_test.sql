begin;
select plan(29);

-- service_role: privileges required by the Next.js server
select table_privs_are('public', 'projects', 'anon', array[]::text[], 'anon has no privileges on projects');
select table_privs_are('public', 'tasks', 'anon', array[]::text[], 'anon has no privileges on tasks');
select table_privs_are('public', 'project_resources', 'anon', array[]::text[], 'anon has no privileges on project_resources');
select table_privs_are('public', 'projects', 'authenticated', array[]::text[], 'authenticated has no privileges on projects');
select table_privs_are('public', 'tasks', 'authenticated', array[]::text[], 'authenticated has no privileges on tasks');
select table_privs_are('public', 'project_resources', 'authenticated', array[]::text[], 'authenticated has no privileges on project_resources');

select ok(has_table_privilege('service_role', 'public.projects', 'SELECT'), 'service_role can SELECT projects');
select ok(has_table_privilege('service_role', 'public.projects', 'INSERT'), 'service_role can INSERT projects');
select ok(has_table_privilege('service_role', 'public.projects', 'UPDATE'), 'service_role can UPDATE projects');
select ok(has_table_privilege('service_role', 'public.projects', 'DELETE'), 'service_role can DELETE projects');
select ok(has_table_privilege('service_role', 'public.tasks', 'SELECT'), 'service_role can SELECT tasks');
select ok(has_table_privilege('service_role', 'public.tasks', 'INSERT'), 'service_role can INSERT tasks');
select ok(has_table_privilege('service_role', 'public.tasks', 'UPDATE'), 'service_role can UPDATE tasks');
select ok(has_table_privilege('service_role', 'public.tasks', 'DELETE'), 'service_role can DELETE tasks');
select ok(has_table_privilege('service_role', 'public.project_resources', 'SELECT'), 'service_role can SELECT project_resources');
select ok(has_table_privilege('service_role', 'public.project_resources', 'INSERT'), 'service_role can INSERT project_resources');
select ok(has_table_privilege('service_role', 'public.project_resources', 'UPDATE'), 'service_role can UPDATE project_resources');
select ok(has_table_privilege('service_role', 'public.project_resources', 'DELETE'), 'service_role can DELETE project_resources');

-- service_role can operate end to end (RLS has no policies, service_role bypasses it)
set local role service_role;
select lives_ok($$insert into public.projects (id, name) values ('00000000-0000-0000-0000-0000000000a1', 'SR')$$, 'service_role inserts project');
select lives_ok($$insert into public.tasks (project_id, title) values ('00000000-0000-0000-0000-0000000000a1', 't')$$, 'service_role inserts task');
select lives_ok($$insert into public.project_resources (project_id, label) values ('00000000-0000-0000-0000-0000000000a1', 'r')$$, 'service_role inserts resource');
select is((select count(*)::int from public.projects where id = '00000000-0000-0000-0000-0000000000a1'), 1, 'service_role reads projects');
select lives_ok($$update public.projects set notes = 'n' where id = '00000000-0000-0000-0000-0000000000a1'$$, 'service_role updates project (updated_at trigger)');
select lives_ok($$update public.tasks set completed = true where project_id = '00000000-0000-0000-0000-0000000000a1'$$, 'service_role updates task');
select lives_ok($$delete from public.projects where id = '00000000-0000-0000-0000-0000000000a1'$$, 'service_role deletes project (cascade)');
reset role;

-- anon / authenticated remain blocked
set local role anon;
select throws_ok($$select * from public.project_resources$$, '42501', null, 'anon cannot read project_resources');
select throws_ok($$delete from public.projects$$, '42501', null, 'anon cannot delete projects');
reset role;
set local role authenticated;
select throws_ok($$select * from public.projects$$, '42501', null, 'authenticated cannot read projects');
select throws_ok($$insert into public.tasks (project_id, title) values ('00000000-0000-0000-0000-0000000000a1', 'x')$$, '42501', null, 'authenticated cannot insert tasks');
reset role;

select * from finish();
rollback;
