-- Caca Bumbu — foto produk
-- 1) Kolom image_url pada products.
-- 2) Bucket storage publik "product-images" untuk foto bumbu.
-- 3) Policy: siapa pun boleh melihat, pemilik akun hanya boleh menulis
--    di folder miliknya sendiri (folder pertama = auth.uid()).

alter table public.products
  add column if not exists image_url text not null default '';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  3145728,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "product_images_read" on storage.objects;
create policy "product_images_read"
  on storage.objects
  for select
  to public
  using (bucket_id = 'product-images');

drop policy if exists "product_images_insert" on storage.objects;
create policy "product_images_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "product_images_update" on storage.objects;
create policy "product_images_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "product_images_delete" on storage.objects;
create policy "product_images_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
