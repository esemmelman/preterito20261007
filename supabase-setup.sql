-- Apply to the selected Supabase project. Recordings are private per account.
create table public.spanish_recordings (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id text not null,
  page_key text not null,
  object_path text not null,
  primary key (user_id, lesson_id, page_key),
  constraint own_object_path check (split_part(object_path, '/', 1) = user_id::text)
);
alter table public.spanish_recordings enable row level security;
grant select, insert, update, delete on public.spanish_recordings to authenticated;
revoke all on public.spanish_recordings from anon;
create policy spanish_recordings_read on public.spanish_recordings for select to authenticated
  using ((select auth.uid()) = user_id);
create policy spanish_recordings_insert on public.spanish_recordings for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy spanish_recordings_update on public.spanish_recordings for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy spanish_recordings_delete on public.spanish_recordings for delete to authenticated
  using ((select auth.uid()) = user_id);
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('spanish-page-recordings', 'spanish-page-recordings', false, 52428800,
  array['audio/webm','audio/mp4','audio/ogg','audio/wav','audio/x-m4a']);
create policy spanish_audio_read on storage.objects for select to authenticated
  using (bucket_id = 'spanish-page-recordings' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy spanish_audio_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'spanish-page-recordings' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy spanish_audio_delete on storage.objects for delete to authenticated
  using (bucket_id = 'spanish-page-recordings' and (storage.foldername(name))[1] = (select auth.uid())::text);
