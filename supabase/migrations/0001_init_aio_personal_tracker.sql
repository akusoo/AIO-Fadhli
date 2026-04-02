create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  location text not null default 'Jakarta',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.accounts (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('cash', 'bank', 'e-wallet')),
  balance bigint not null default 0,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  deleted_at timestamptz
);

create table if not exists public.categories (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('income', 'expense')),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  deleted_at timestamptz
);

create table if not exists public.budget_cycles (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  start_on date not null,
  end_on date not null,
  target_amount bigint not null default 0,
  spent_amount bigint not null default 0,
  income_amount bigint not null default 0,
  status text not null check (status in ('active', 'completed', 'planned')),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  deleted_at timestamptz
);

create table if not exists public.budget_category_allocations (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  cycle_id text not null references public.budget_cycles(id) on delete cascade,
  category_id text not null references public.categories(id) on delete cascade,
  allocated_amount bigint not null default 0,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  deleted_at timestamptz
);

create table if not exists public.transactions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  kind text not null check (kind in ('income', 'expense', 'transfer')),
  amount bigint not null,
  occurred_on date not null,
  account_id text not null references public.accounts(id) on delete restrict,
  category_id text references public.categories(id) on delete set null,
  cycle_id text references public.budget_cycles(id) on delete set null,
  merchant text,
  tags text[] not null default '{}',
  note text,
  transfer_target_account_id text references public.accounts(id) on delete set null,
  source_type text check (source_type in ('shopping', 'debt_installment')),
  source_id text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  deleted_at timestamptz
);

create table if not exists public.recurring_plans (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  kind text not null check (kind in ('income', 'expense')),
  amount bigint not null,
  cadence text not null check (cadence in ('weekly', 'monthly', 'custom')),
  next_occurrence_on date not null,
  account_id text not null references public.accounts(id) on delete restrict,
  category_id text references public.categories(id) on delete set null,
  merchant text,
  tags text[] not null default '{}',
  note text,
  enabled boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  deleted_at timestamptz
);

create table if not exists public.debts (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  lender text not null,
  principal_amount bigint not null,
  remaining_amount bigint not null default 0,
  installment_amount bigint not null default 0,
  total_months integer not null default 0,
  remaining_months integer not null default 0,
  note text,
  status text not null check (status in ('healthy', 'watch', 'overdue', 'paid')),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  deleted_at timestamptz
);

create table if not exists public.debt_installments (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  debt_id text not null references public.debts(id) on delete cascade,
  installment_number integer not null,
  due_on date not null,
  amount bigint not null,
  late_fee_amount bigint not null default 0,
  status text not null check (status in ('healthy', 'watch', 'overdue', 'paid')),
  status_source text not null check (status_source in ('auto', 'manual')),
  paid_on date,
  note text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  deleted_at timestamptz
);

create table if not exists public.debt_payments (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  debt_id text not null references public.debts(id) on delete cascade,
  installment_id text not null references public.debt_installments(id) on delete cascade,
  amount bigint not null,
  paid_on date not null,
  remaining_amount bigint not null default 0,
  note text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  deleted_at timestamptz
);

create table if not exists public.projects (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text not null,
  status text not null check (status in ('active', 'paused', 'done')),
  focus text not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  deleted_at timestamptz
);

create table if not exists public.tasks (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  status text not null check (status in ('todo', 'doing', 'done')),
  priority text not null check (priority in ('low', 'medium', 'high')),
  due_on date,
  project_id text references public.projects(id) on delete set null,
  today_pinned boolean not null default false,
  note text,
  start_time text,
  due_time text,
  reminder_at text,
  completed_at text,
  recurring_cadence text check (recurring_cadence in ('daily', 'weekly', 'monthly')),
  recurring_interval integer,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  deleted_at timestamptz
);

create table if not exists public.subtasks (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id text not null references public.tasks(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  note text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  deleted_at timestamptz
);

create table if not exists public.notes (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  content text not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  deleted_at timestamptz
);

create table if not exists public.note_links (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  note_id text not null references public.notes(id) on delete cascade,
  link_type text not null check (link_type in ('task', 'project')),
  link_id text not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  deleted_at timestamptz
);

create table if not exists public.wish_items (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_price bigint not null,
  priority text not null check (priority in ('low', 'medium', 'high')),
  status text not null check (status in ('wish', 'ready', 'moved')),
  note text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  deleted_at timestamptz
);

create table if not exists public.shopping_items (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  estimated_price bigint not null,
  quantity integer not null default 1,
  section text not null default 'Lainnya',
  status text not null check (status in ('planned', 'buying', 'bought')),
  store text,
  source_wish_id text references public.wish_items(id) on delete set null,
  note text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  deleted_at timestamptz
);

create table if not exists public.reminder_rules (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('telegram')),
  cadence text not null check (cadence in ('event-based', 'daily-digest')),
  enabled boolean not null default true,
  label text not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  deleted_at timestamptz
);

create unique index if not exists note_links_unique_active_idx
on public.note_links(note_id, link_type, link_id)
where deleted_at is null;

create index if not exists accounts_user_idx on public.accounts(user_id) where deleted_at is null;
create index if not exists categories_user_idx on public.categories(user_id) where deleted_at is null;
create index if not exists budget_cycles_user_idx on public.budget_cycles(user_id) where deleted_at is null;
create index if not exists transactions_user_date_idx on public.transactions(user_id, occurred_on desc) where deleted_at is null;
create index if not exists recurring_plans_user_idx on public.recurring_plans(user_id) where deleted_at is null;
create index if not exists debts_user_idx on public.debts(user_id) where deleted_at is null;
create index if not exists debt_installments_user_due_idx on public.debt_installments(user_id, due_on asc) where deleted_at is null;
create index if not exists debt_payments_user_paid_idx on public.debt_payments(user_id, paid_on desc) where deleted_at is null;
create index if not exists projects_user_idx on public.projects(user_id) where deleted_at is null;
create index if not exists tasks_user_idx on public.tasks(user_id) where deleted_at is null;
create index if not exists subtasks_user_idx on public.subtasks(user_id) where deleted_at is null;
create index if not exists notes_user_idx on public.notes(user_id) where deleted_at is null;
create index if not exists note_links_user_idx on public.note_links(user_id) where deleted_at is null;
create index if not exists wish_items_user_idx on public.wish_items(user_id) where deleted_at is null;
create index if not exists shopping_items_user_idx on public.shopping_items(user_id) where deleted_at is null;
create index if not exists reminder_rules_user_idx on public.reminder_rules(user_id) where deleted_at is null;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger accounts_set_updated_at
before update on public.accounts
for each row execute function public.set_updated_at();

create trigger categories_set_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

create trigger budget_cycles_set_updated_at
before update on public.budget_cycles
for each row execute function public.set_updated_at();

create trigger budget_category_allocations_set_updated_at
before update on public.budget_category_allocations
for each row execute function public.set_updated_at();

create trigger transactions_set_updated_at
before update on public.transactions
for each row execute function public.set_updated_at();

create trigger recurring_plans_set_updated_at
before update on public.recurring_plans
for each row execute function public.set_updated_at();

create trigger debts_set_updated_at
before update on public.debts
for each row execute function public.set_updated_at();

create trigger debt_installments_set_updated_at
before update on public.debt_installments
for each row execute function public.set_updated_at();

create trigger debt_payments_set_updated_at
before update on public.debt_payments
for each row execute function public.set_updated_at();

create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

create trigger subtasks_set_updated_at
before update on public.subtasks
for each row execute function public.set_updated_at();

create trigger notes_set_updated_at
before update on public.notes
for each row execute function public.set_updated_at();

create trigger note_links_set_updated_at
before update on public.note_links
for each row execute function public.set_updated_at();

create trigger wish_items_set_updated_at
before update on public.wish_items
for each row execute function public.set_updated_at();

create trigger shopping_items_set_updated_at
before update on public.shopping_items
for each row execute function public.set_updated_at();

create trigger reminder_rules_set_updated_at
before update on public.reminder_rules
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.budget_cycles enable row level security;
alter table public.budget_category_allocations enable row level security;
alter table public.transactions enable row level security;
alter table public.recurring_plans enable row level security;
alter table public.debts enable row level security;
alter table public.debt_installments enable row level security;
alter table public.debt_payments enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.subtasks enable row level security;
alter table public.notes enable row level security;
alter table public.note_links enable row level security;
alter table public.wish_items enable row level security;
alter table public.shopping_items enable row level security;
alter table public.reminder_rules enable row level security;

create policy "profiles own rows" on public.profiles
for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "accounts own rows" on public.accounts
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "categories own rows" on public.categories
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "budget_cycles own rows" on public.budget_cycles
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "budget_allocations own rows" on public.budget_category_allocations
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "transactions own rows" on public.transactions
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "recurring_plans own rows" on public.recurring_plans
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "debts own rows" on public.debts
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "debt_installments own rows" on public.debt_installments
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "debt_payments own rows" on public.debt_payments
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "projects own rows" on public.projects
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "tasks own rows" on public.tasks
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "subtasks own rows" on public.subtasks
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "notes own rows" on public.notes
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "note_links own rows" on public.note_links
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "wish_items own rows" on public.wish_items
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "shopping_items own rows" on public.shopping_items
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "reminder_rules own rows" on public.reminder_rules
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
