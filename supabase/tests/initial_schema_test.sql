begin;
select plan(33);

-- Structure
select has_table('public', 'projects', 'projects exists');
select has_table('public', 'tasks', 'tasks exists');
select has_table('public', 'project_resources', 'project_resources exists');
select col_is_pk('public', 'projects', 'id', 'projects.id is PK');
select col_is_pk('public', 'tasks', 'id', 'tasks.id is PK');
select col_is_pk('public', 'project_resources', 'id', 'project_resources.id is PK');
select fk_ok('public', 'tasks', 'project_id', 'public', 'projects', 'id');
select fk_ok('public', 'project_resources', 'project_id', 'public', 'projects', 'id');
select has_index('public', 'tasks', 'tasks_project_id_position_idx', 'tasks index on (project_id, position)');
select has_index('public', 'project_resources', 'project_resources_project_id_idx', 'project_resources index on project_id');
select has_index('public', 'projects', 'projects_status_idx', 'projects index on status');
select has_index('public', 'projects', 'projects_updated_at_idx', 'projects index on updated_at');

-- RLS enabled on every table
select ok((select relrowsecurity from pg_class where oid = 'public.projects'::regclass), 'RLS on projects');
select ok((select relrowsecurity from pg_class where oid = 'public.tasks'::regclass), 'RLS on tasks');
select ok((select relrowsecurity from pg_class where oid = 'public.project_resources'::regclass), 'RLS on project_resources');

-- Defaults
insert into public.projects (id, name) values ('00000000-0000-0000-0000-000000000001', 'Demo');
select results_eq(
  $$select status, progress_mode, manual_progress from public.projects where name = 'Demo'$$,
  $$values ('active'::text, 'manual'::text, 0::smallint)$$,
  'project defaults'
);

-- Check constraints
select throws_ok($$insert into public.projects (name) values ('   ')$$, '23514', null, 'blank project name rejected');
select throws_ok($$insert into public.projects (name, status) values ('x', 'archived')$$, '23514', null, 'invalid status rejected');
select throws_ok($$insert into public.projects (name, progress_mode) values ('x', 'auto')$$, '23514', null, 'invalid progress_mode rejected');
select throws_ok($$insert into public.projects (name, manual_progress) values ('x', 101)$$, '23514', null, 'manual_progress > 100 rejected');
select throws_ok($$insert into public.projects (name, repository_url) values ('x', 'javascript:alert(1)')$$, '23514', null, 'non-http repository_url rejected');
select throws_ok($$insert into public.tasks (project_id, title) values ('00000000-0000-0000-0000-000000000001', '')$$, '23514', null, 'blank task title rejected');
select throws_ok($$insert into public.tasks (project_id, title, position) values ('00000000-0000-0000-0000-000000000001', 't', -1)$$, '23514', null, 'negative position rejected');
select throws_ok($$insert into public.project_resources (project_id, type, label) values ('00000000-0000-0000-0000-000000000001', 'aws', 'x')$$, '23514', null, 'invalid resource type rejected');
select throws_ok($$insert into public.tasks (project_id, title) values ('00000000-0000-0000-0000-00000000dead', 't')$$, '23503', null, 'task with unknown project rejected');

-- updated_at trigger
update public.projects set updated_at = '2000-01-01' where name = 'Demo';
update public.projects set notes = 'changed' where name = 'Demo';
select ok((select updated_at > '2000-01-01' from public.projects where name = 'Demo'), 'projects.updated_at refreshed on update');

-- Next step = first pending task by position
insert into public.tasks (project_id, title, position, completed) values
  ('00000000-0000-0000-0000-000000000001', 'done', 0, true),
  ('00000000-0000-0000-0000-000000000001', 'next', 1, false),
  ('00000000-0000-0000-0000-000000000001', 'later', 2, false);
select is(
  (select title from public.tasks where project_id = '00000000-0000-0000-0000-000000000001' and not completed order by position limit 1),
  'next',
  'first pending task by position'
);
insert into public.project_resources (project_id, type, label, url, account)
values ('00000000-0000-0000-0000-000000000001', 'github', 'Repo', 'https://github.com/x/y', 'me@example.com');

-- Anon / authenticated have no access through the Data API roles
set local role anon;
select throws_ok($$select * from public.projects$$, '42501', null, 'anon cannot read projects');
select throws_ok($$insert into public.projects (name) values ('x')$$, '42501', null, 'anon cannot insert projects');
reset role;
set local role authenticated;
select throws_ok($$select * from public.tasks$$, '42501', null, 'authenticated cannot read tasks');
reset role;
set local role service_role;
select is((select count(*)::int from public.tasks), 3, 'service_role can read tasks');
reset role;

-- Cascade delete
delete from public.projects where id = '00000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.tasks), 0, 'tasks deleted with project');
select is((select count(*)::int from public.project_resources), 0, 'resources deleted with project');

select * from finish();
rollback;
