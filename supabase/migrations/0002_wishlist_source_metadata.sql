alter table public.wish_items
add column if not exists source_url text,
add column if not exists image_url text;
