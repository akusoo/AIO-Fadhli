create table if not exists public.investments (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  platform text not null,
  instrument text not null check (instrument in ('stock', 'fund', 'bond', 'crypto', 'gold', 'money-market', 'other')),
  status text not null check (status in ('active', 'paused', 'closed')) default 'active',
  start_date date not null,
  invested_amount bigint not null,
  current_value bigint not null,
  account_id text not null references public.accounts(id) on delete restrict,
  category_id text references public.categories(id) on delete set null,
  tags text[] not null default '{}',
  note text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  deleted_at timestamptz
);

create table if not exists public.investment_valuations (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  investment_id text not null references public.investments(id) on delete cascade,
  valued_on date not null,
  current_value bigint not null,
  note text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  deleted_at timestamptz
);

create unique index if not exists investment_valuations_unique_active_idx
on public.investment_valuations(investment_id, valued_on)
where deleted_at is null;

create index if not exists investments_user_idx on public.investments(user_id) where deleted_at is null;
create index if not exists investments_user_status_idx on public.investments(user_id, status) where deleted_at is null;
create index if not exists investment_valuations_user_date_idx on public.investment_valuations(user_id, valued_on desc) where deleted_at is null;
create index if not exists investment_valuations_investment_idx on public.investment_valuations(investment_id) where deleted_at is null;

create trigger investments_set_updated_at
before update on public.investments
for each row execute function public.set_updated_at();

create trigger investment_valuations_set_updated_at
before update on public.investment_valuations
for each row execute function public.set_updated_at();

alter table public.investments enable row level security;
alter table public.investment_valuations enable row level security;

create policy "investments own rows" on public.investments
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "investment_valuations own rows" on public.investment_valuations
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.transactions
drop constraint if exists transactions_source_type_check;

alter table public.transactions
add constraint transactions_source_type_check
check (source_type in ('shopping', 'debt_installment', 'investment'));
