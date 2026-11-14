-- Run in Supabase SQL editor. All user content is private by default.
create table if not exists public.folders (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (char_length(name) between 1 and 80), parent_id uuid,
 created_at timestamptz not null default now(),
 unique(id,user_id)
);
alter table public.folders add constraint folders_parent_owner_fk foreign key (parent_id,user_id) references public.folders(id,user_id) on delete set null (parent_id);
create table if not exists public.bookmarks (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 url text not null check (char_length(url) between 1 and 2048), platform text not null check (platform in ('instagram','youtube','other')),
 title text not null default '', category text not null default 'Unsorted', notes text not null default '',
 folder_id uuid, saved_at timestamptz not null default now(),
 unique(id,user_id), unique(user_id,url),
 foreign key (folder_id,user_id) references public.folders(id,user_id) on delete set null (folder_id)
);
create index if not exists bookmarks_user_date on public.bookmarks(user_id,saved_at desc);
create index if not exists folders_user on public.folders(user_id);
alter table public.folders enable row level security;
alter table public.bookmarks enable row level security;
create policy "folders_select_own" on public.folders for select to authenticated using ((select auth.uid())=user_id);
create policy "folders_insert_own" on public.folders for insert to authenticated with check ((select auth.uid())=user_id);
create policy "folders_update_own" on public.folders for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "folders_delete_own" on public.folders for delete to authenticated using ((select auth.uid())=user_id);
create policy "bookmarks_select_own" on public.bookmarks for select to authenticated using ((select auth.uid())=user_id);
create policy "bookmarks_insert_own" on public.bookmarks for insert to authenticated with check ((select auth.uid())=user_id);
create policy "bookmarks_update_own" on public.bookmarks for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy "bookmarks_delete_own" on public.bookmarks for delete to authenticated using ((select auth.uid())=user_id);
