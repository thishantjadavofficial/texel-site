-- 1. CLEANUP
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user cascade;
drop table if exists public.transaction_items cascade;
drop table if exists public.transactions cascade;
drop table if exists public.vault_items cascade;
drop table if exists public.designs cascade;
drop table if exists public.profiles cascade;

-- 2. ENABLE EXTENSIONS
create extension if not exists "uuid-ossp";

-- 3. STORAGE SETUP
-- Create storage bucket 'designs' if it does not exist
insert into storage.buckets (id, name, public)
values ('designs', 'designs', true)
on conflict (id) do nothing;

-- Storage Policies
drop policy if exists "Allow public read access to designs" on storage.objects;
drop policy if exists "Allow authenticated upload to designs" on storage.objects;
drop policy if exists "Allow owners to manage their own designs files" on storage.objects;

create policy "Allow public read access to designs"
  on storage.objects for select
  using (bucket_id = 'designs');

create policy "Allow authenticated upload to designs"
  on storage.objects for insert
  with check (
    bucket_id = 'designs'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Allow owners to manage their own designs files"
  on storage.objects for all
  using (
    bucket_id = 'designs'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 4. TABLES
-- Profiles Table: Mutual for all platform members, role column removed.
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null unique,
  has_accepted_tc boolean not null default false,
  name text,
  bio text,
  organization text,
  region text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Designs Table: designer_id renamed to user_id (the creator)
create table public.designs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  tags text[] not null default '{}',
  preview_url text not null,
  master_url text not null,
  base_price numeric(10, 2) not null check (base_price >= 0),
  max_discount_pct numeric(5, 2) not null check (max_discount_pct >= 0 and max_discount_pct <= 100),
  is_active boolean not null default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Vault Items (Cart): buyer_id renamed to user_id (the consumer saving it)
create table public.vault_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  design_id uuid references public.designs(id) on delete cascade not null,
  added_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, design_id)
);

-- Transactions: buyer_id renamed to user_id
create table public.transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  total_paid numeric(10, 2) not null check (total_paid >= 0),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Transaction Items: Links transacted designs to transactions
create table public.transaction_items (
  id uuid default gen_random_uuid() primary key,
  transaction_id uuid references public.transactions(id) on delete cascade not null,
  design_id uuid references public.designs(id) on delete cascade not null,
  original_price numeric(10, 2) not null check (original_price >= 0),
  final_discounted_price numeric(10, 2) not null check (final_discounted_price >= 0)
);

-- Indexes for performance optimization
create index idx_designs_user_id on public.designs(user_id);
create index idx_vault_items_user_id on public.vault_items(user_id);
create index idx_transactions_user_id on public.transactions(user_id);
create index idx_transaction_items_tx_id on public.transaction_items(transaction_id);

-- 5. RLS ENABLEMENT & POLICIES
alter table public.profiles enable row level security;
alter table public.designs enable row level security;
alter table public.vault_items enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_items enable row level security;

-- Profiles Policies
create policy "Allow public read access to profiles" on public.profiles for select using (true);
create policy "Allow users to insert their own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Allow users to update their own profile" on public.profiles for update using (auth.uid() = id);

-- Designs Policies: Anyone can upload a design, and ownership is bound to user_id
create policy "Allow public read access to active designs" on public.designs for select using (is_active = true);
create policy "Allow users to insert their own designs" on public.designs for insert with check (auth.uid() = user_id);
create policy "Allow users to update their own designs" on public.designs for update using (auth.uid() = user_id);
create policy "Allow users to delete their own designs" on public.designs for delete using (auth.uid() = user_id);

-- Vault Items Policies: Anyone can manage their own vault items
create policy "Allow users to manage their own vault" on public.vault_items for all using (auth.uid() = user_id);

-- Transactions Policies: Anyone can manage their own transactions
create policy "Allow users to view their own transactions" on public.transactions for select using (auth.uid() = user_id);
create policy "Allow users to create transactions" on public.transactions for insert with check (auth.uid() = user_id);

-- Transaction Items Policies: Anyone can view or insert items associated with their transactions
create policy "Allow users to view their own transaction items" 
  on public.transaction_items for select 
  using (
    exists (
      select 1 from public.transactions 
      where id = transaction_items.transaction_id and user_id = auth.uid()
    )
  );

create policy "Allow users to insert transaction items" 
  on public.transaction_items for insert 
  with check (
    exists (
      select 1 from public.transactions 
      where id = transaction_items.transaction_id and user_id = auth.uid()
    )
  );

-- 6. TRIGGERS
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, has_accepted_tc, name, bio, organization, region)
  values (
    new.id, 
    new.email, 
    false, 
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), 
    '', 
    '', 
    ''
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
