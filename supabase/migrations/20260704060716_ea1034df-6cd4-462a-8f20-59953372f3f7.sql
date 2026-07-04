
-- ============ ROLES ============
create type public.app_role as enum ('soc_analyst','fraud_analyst','risk_manager','executive');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles read own or any authed" on public.profiles for select to authenticated using (true);
create policy "profiles update own" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select, insert, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "roles read own" on public.user_roles for select to authenticated using (auth.uid() = user_id);
create policy "roles set own" on public.user_roles for insert to authenticated with check (auth.uid() = user_id);
create policy "roles delete own" on public.user_roles for delete to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_analyst(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id)
$$;

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ CORE DOMAIN ============
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  country text,
  segment text,
  risk_baseline int not null default 20,
  created_at timestamptz not null default now()
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete cascade,
  fingerprint text not null,
  os text, browser text, trusted boolean default false,
  last_seen timestamptz default now()
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete cascade,
  device_id uuid references public.devices(id) on delete set null,
  ip inet, country text, city text,
  is_vpn boolean default false, is_tor boolean default false,
  started_at timestamptz not null default now()
);

create table public.beneficiaries (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete cascade,
  name text not null, iban text, country text,
  trusted boolean default false,
  created_at timestamptz default now()
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete set null,
  device_id uuid references public.devices(id) on delete set null,
  beneficiary_id uuid references public.beneficiaries(id) on delete set null,
  amount numeric(14,2) not null,
  currency text not null default 'USD',
  channel text not null default 'wire',
  merchant text,
  country text,
  status text not null default 'pending', -- pending|approved|blocked|reviewed
  risk_score int,
  created_at timestamptz not null default now()
);
create index on public.transactions (created_at desc);
create index on public.transactions (customer_id);
create index on public.transactions (risk_score desc);

create table public.cyber_telemetry (
  id uuid primary key default gen_random_uuid(),
  source text not null, -- firewall|vpn|iam|endpoint|email|cloud|dns|auth
  severity text not null default 'info', -- info|low|medium|high|critical
  user_ref text, device text, ip inet,
  message text, risk_score int,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.cyber_telemetry (created_at desc);
create index on public.cyber_telemetry (severity);

create table public.threat_intel (
  id uuid primary key default gen_random_uuid(),
  kind text not null, -- campaign|malware|actor
  name text not null,
  origin_country text,
  severity text not null default 'medium',
  description text,
  first_seen timestamptz default now()
);

create table public.iocs (
  id uuid primary key default gen_random_uuid(),
  type text not null, -- ip|domain|hash|url
  value text not null unique,
  severity text not null default 'medium',
  threat_id uuid references public.threat_intel(id) on delete set null,
  seen_count int default 1,
  last_seen timestamptz default now()
);

create table public.risk_scores (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid references public.transactions(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete cascade,
  composite int not null,
  contributors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.risk_scores (created_at desc);

create table public.ai_investigations (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid references public.transactions(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  title text not null,
  confidence int not null default 80,
  attack_type text,
  business_impact numeric(14,2) default 0,
  root_cause text,
  evidence jsonb default '[]'::jsonb,
  risk_factors jsonb default '[]'::jsonb,
  recommended_actions jsonb default '[]'::jsonb,
  compliance jsonb default '[]'::jsonb,
  status text not null default 'open',
  created_at timestamptz not null default now()
);
create index on public.ai_investigations (created_at desc);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  investigation_id uuid references public.ai_investigations(id) on delete set null,
  transaction_id uuid references public.transactions(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  severity text not null default 'medium', -- critical|high|medium|low|info
  title text not null,
  source text,
  status text not null default 'open', -- open|acknowledged|resolved
  assignee uuid references auth.users(id) on delete set null,
  sla_minutes int default 60,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.alerts (created_at desc);
create index on public.alerts (severity);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  severity text default 'info',
  alert_id uuid references public.alerts(id) on delete cascade,
  read boolean default false,
  created_at timestamptz not null default now()
);
create index on public.notifications (created_at desc);

create table public.quantum_assets (
  id uuid primary key default gen_random_uuid(),
  asset text not null,
  algo text not null,
  key_size int,
  tls_version text,
  sensitivity int default 50,
  migration_status text default 'pending', -- pending|in_progress|migrated
  expires_at timestamptz,
  created_at timestamptz default now()
);

create table public.knowledge_edges (
  id uuid primary key default gen_random_uuid(),
  src_type text not null, src_id text not null,
  dst_type text not null, dst_id text not null,
  weight int default 1,
  created_at timestamptz not null default now()
);
create index on public.knowledge_edges (created_at desc);

-- ============ GRANTS + RLS: analysts read all, only service writes ============
do $$
declare t text;
begin
  foreach t in array array[
    'customers','devices','sessions','beneficiaries','transactions',
    'cyber_telemetry','threat_intel','iocs','risk_scores','ai_investigations',
    'alerts','notifications','quantum_assets','knowledge_edges'
  ] loop
    execute format('grant select on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%s analyst read" on public.%I for select to authenticated using (public.is_analyst(auth.uid()))', t, t);
  end loop;
end $$;

-- Allow analysts to update alerts (ack/resolve/assign)
create policy "alerts analyst update" on public.alerts for update to authenticated
  using (public.is_analyst(auth.uid())) with check (public.is_analyst(auth.uid()));

-- Allow analysts to mark notifications read
create policy "notif analyst update" on public.notifications for update to authenticated
  using (public.is_analyst(auth.uid())) with check (public.is_analyst(auth.uid()));

-- ============ REALTIME ============
alter publication supabase_realtime add table public.transactions;
alter publication supabase_realtime add table public.alerts;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.ai_investigations;
alter publication supabase_realtime add table public.risk_scores;
alter publication supabase_realtime add table public.cyber_telemetry;
