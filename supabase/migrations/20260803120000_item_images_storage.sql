alter table items rename column image_url to image_path;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('item-images', 'item-images', false, 2097152, array['image/jpeg'])
on conflict (id) do update set
  public            = excluded.public,
  file_size_limit   = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy item_images_select on storage.objects for select to authenticated
  using (
    bucket_id = 'item-images'
    and (storage.foldername(name))[1] in (
      select c.community_id::text from public.member_community_ids() as c(community_id)
    )
  );

create policy item_images_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'item-images'
    and (storage.foldername(name))[1] in (
      select c.community_id::text from public.member_community_ids() as c(community_id)
    )
  );

create policy item_images_update on storage.objects for update to authenticated
  using (
    bucket_id = 'item-images'
    and (storage.foldername(name))[1] in (
      select c.community_id::text from public.member_community_ids() as c(community_id)
    )
  )
  with check (
    bucket_id = 'item-images'
    and (storage.foldername(name))[1] in (
      select c.community_id::text from public.member_community_ids() as c(community_id)
    )
  );

create policy item_images_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'item-images'
    and (storage.foldername(name))[1] in (
      select c.community_id::text from public.member_community_ids() as c(community_id)
    )
  );
