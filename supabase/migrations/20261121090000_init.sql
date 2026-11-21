-- Caca Bumbu — skema Supabase
-- Satu akun (auth.users) memiliki satu set data usaha.
-- Semua tabel memakai kunci gabungan (user_id, id) dan dilindungi RLS.
--
-- Cara menjalankan:
--   supabase link --project-ref <ref>
--   supabase db push
-- atau tempel seluruh file ini di Supabase Dashboard → SQL Editor → Run.
-- atau: pnpm db:apply (memakai Management API + SUPABASE_ACCESS_TOKEN).

create extension if not exists pgcrypto;

-- ------------------------------- products -----------------------------------
create table if not exists public.products (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  name text not null,
  price numeric(14, 2) not null default 0,
  hpp numeric(14, 2) not null default 0,
  stock numeric(14, 2) not null default 0,
  unit text not null default 'pack',
  tone text not null default 'saffron',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- -------------------------------- warungs -----------------------------------
create table if not exists public.warungs (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  name text not null,
  owner text not null default '',
  phone text not null default '',
  address text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- --------------------------------- sales ------------------------------------
create table if not exists public.sales (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  code text not null,
  date timestamptz not null default now(),
  warung_id text,
  buyer_name text not null default '',
  items jsonb not null default '[]'::jsonb,
  total numeric(14, 2) not null default 0,
  note text not null default '',
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- ----------------------------- consignments ----------------------------------
create table if not exists public.consignments (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  code text not null,
  warung_id text not null,
  date timestamptz not null default now(),
  due_date date not null,
  items jsonb not null default '[]'::jsonb,
  status text not null default 'aktif' check (status in ('aktif', 'selesai')),
  closed_at timestamptz,
  note text not null default '',
  close_note text not null default '',
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- -------------------------------- payments ----------------------------------
create table if not exists public.payments (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  ref_type text not null check (ref_type in ('sale', 'consignment')),
  ref_id text not null,
  amount numeric(14, 2) not null default 0,
  date timestamptz not null default now(),
  method text not null default 'Tunai',
  note text not null default '',
  primary key (user_id, id)
);

-- ------------------------------- ingredients --------------------------------
create table if not exists public.ingredients (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  name text not null,
  unit text not null default 'kg',
  category text not null default 'Bumbu',
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- -------------------------------- purchases ---------------------------------
create table if not exists public.purchases (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  code text not null,
  date timestamptz not null default now(),
  supplier text not null default 'Pasar',
  note text not null default '',
  items jsonb not null default '[]'::jsonb,
  total numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- ------------------------------- stock_moves --------------------------------
create table if not exists public.stock_moves (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  date timestamptz not null default now(),
  product_id text not null,
  qty numeric(14, 2) not null default 0,
  type text not null default 'opname',
  ref_id text,
  note text,
  primary key (user_id, id)
);

-- ------------------------------- app_settings -------------------------------
create table if not exists public.app_settings (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  business_name text not null default 'Caca Bumbu',
  owner_name text not null default 'Caca',
  phone text not null default '',
  whatsapp text not null default '',
  address text not null default '',
  low_stock_threshold integer not null default 5,
  updated_at timestamptz not null default now(),
  primary key (user_id)
);

-- -------------------------------- app_meta ----------------------------------
create table if not exists public.app_meta (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  onboarded boolean not null default false,
  demo boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id)
);

-- --------------------------- app_settings timestamp -------------------------
create or replace function public.touch_app_settings()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists app_settings_touch on public.app_settings;
create trigger app_settings_touch
  before insert or update on public.app_settings
  for each row execute function public.touch_app_settings();

-- --------------------------------- indexes ----------------------------------
create index if not exists products_user_idx on public.products (user_id);
create index if not exists warungs_user_idx on public.warungs (user_id);
create index if not exists sales_user_date_idx on public.sales (user_id, date desc);
create index if not exists consignments_user_date_idx on public.consignments (user_id, date desc);
create index if not exists consignments_user_status_idx on public.consignments (user_id, status);
create index if not exists payments_user_date_idx on public.payments (user_id, date desc);
create index if not exists payments_user_ref_idx on public.payments (user_id, ref_type, ref_id);
create index if not exists ingredients_user_idx on public.ingredients (user_id);
create index if not exists purchases_user_date_idx on public.purchases (user_id, date desc);
create index if not exists stock_moves_user_date_idx on public.stock_moves (user_id, date desc);
create index if not exists stock_moves_user_product_idx on public.stock_moves (user_id, product_id);

-- ------------------------- RLS, policies, and grants ------------------------
do $$
declare
  table_name text;
  policy_name text;
begin
  foreach table_name in array array[
    'products', 'warungs', 'sales', 'consignments', 'payments',
    'ingredients', 'purchases', 'stock_moves', 'app_settings', 'app_meta'
  ] loop
    policy_name := table_name || '_owner';

    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists %I on public.%I', policy_name, table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      policy_name, table_name
    );
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
    execute format('revoke all on public.%I from anon', table_name);
  end loop;
end $$;

-- --------------------------------- realtime ---------------------------------
-- Tabel dapat dilanggan lewat Supabase Realtime jika diaktifkan.
-- Aplikasi ini memakai sinkronisasi saat fokus/kembali online, jadi realtime
-- bersifat opsional. Jalankan manual bila ingin mencoba:
--   alter publication supabase_realtime add table public.products;
