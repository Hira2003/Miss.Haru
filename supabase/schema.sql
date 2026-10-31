-- Miss Haru: teacher document library schema
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'teacher' check (role in ('teacher','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  teacher_name text not null,
  school_name text not null,
  category text not null check (category in ('lesson','exercise','exam','resource')),
  semester smallint check (semester in (1,2,3)),
  file_path text not null,
  file_name text not null,
  mime_type text not null check (mime_type in ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);

create index if not exists documents_public_listing_idx on public.documents(status, category, semester, created_at desc);
create index if not exists documents_owner_idx on public.documents(uploaded_by, created_at desc);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin');
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.documents enable row level security;

drop policy if exists "Users read own profile; admins read all" on public.profiles;
create policy "Users read own profile; admins read all" on public.profiles
for select to authenticated using (id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "Users update own name; admins update profiles" on public.profiles;
create policy "Users update own name; admins update profiles" on public.profiles
for update to authenticated
using (id = (select auth.uid()) or (select public.is_admin()))
with check ((id = (select auth.uid()) and role = 'teacher') or (select public.is_admin()));

drop policy if exists "Public reads approved documents" on public.documents;
create policy "Public reads approved documents" on public.documents
for select to anon, authenticated
using (status = 'approved' or uploaded_by = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "Teachers submit their own pending documents" on public.documents;
create policy "Teachers submit their own pending documents" on public.documents
for insert to authenticated
with check (uploaded_by = (select auth.uid()) and status = 'pending' and reviewed_at is null and reviewed_by is null);

drop policy if exists "Admins review documents" on public.documents;
create policy "Admins review documents" on public.documents
for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "Admins delete documents" on public.documents;
create policy "Admins delete documents" on public.documents
for delete to authenticated using ((select public.is_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('teacher-submissions', 'teacher-submissions', false, 20971520,
  array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set public = false, file_size_limit = 20971520, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Teachers upload into own folder" on storage.objects;
create policy "Teachers upload into own folder" on storage.objects
for insert to authenticated with check (
  bucket_id = 'teacher-submissions' and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Owners admins and approved docs read files" on storage.objects;
create policy "Owners admins and approved docs read files" on storage.objects
for select to authenticated using (
  bucket_id = 'teacher-submissions' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select public.is_admin())
    or exists (select 1 from public.documents d where d.file_path = name and d.status = 'approved')
  )
);

drop policy if exists "Public can read approved files" on storage.objects;
create policy "Public can read approved files" on storage.objects
for select to anon using (
  bucket_id = 'teacher-submissions' and exists (
    select 1 from public.documents d where d.file_path = name and d.status = 'approved'
  )
);

drop policy if exists "Owners and admins delete files" on storage.objects;
create policy "Owners and admins delete files" on storage.objects
for delete to authenticated using (
  bucket_id = 'teacher-submissions' and (
    (storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin())
  )
);

-- After registering your account, promote it once:
-- update public.profiles set role = 'admin'
-- where id = (select id from auth.users where email = 'YOUR_EMAIL@example.com');
