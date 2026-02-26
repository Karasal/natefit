-- ============================================================
-- NATEFIT Body Scanner — Database Schema
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- Profiles
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  role text not null check (role in ('trainer', 'client')),
  sex text check (sex in ('male', 'female')),
  height_cm numeric,
  date_of_birth date,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- ============================================================
-- Organizations
-- ============================================================
create table public.organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  owner_id uuid references public.profiles(id) on delete set null,
  plan_tier text not null default 'free',
  max_clients int not null default 5,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz default now()
);

alter table public.organizations enable row level security;

create policy "Org members can read their org"
  on public.organizations for select
  using (
    id in (select org_id from public.org_members where user_id = auth.uid())
  );

-- ============================================================
-- Org Members
-- ============================================================
create table public.org_members (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'trainer', 'viewer')),
  created_at timestamptz default now(),
  unique (org_id, user_id)
);

alter table public.org_members enable row level security;

create policy "Org members can read their memberships"
  on public.org_members for select
  using (user_id = auth.uid());

create policy "Org owners can manage members"
  on public.org_members for all
  using (
    org_id in (
      select org_id from public.org_members
      where user_id = auth.uid() and role = 'owner'
    )
  );

-- ============================================================
-- Clients
-- ============================================================
create table public.clients (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  email text not null,
  full_name text not null,
  invite_token uuid,
  invite_status text not null default 'pending' check (invite_status in ('pending', 'accepted', 'expired')),
  tags text[] default '{}',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.clients enable row level security;

create policy "Trainers can read their org clients"
  on public.clients for select
  using (
    org_id in (select org_id from public.org_members where user_id = auth.uid())
  );

create policy "Trainers can manage their org clients"
  on public.clients for all
  using (
    org_id in (select org_id from public.org_members where user_id = auth.uid())
  );

create policy "Clients can read own record"
  on public.clients for select
  using (user_id = auth.uid());

-- ============================================================
-- Scans
-- ============================================================
create table public.scans (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references public.clients(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete cascade,
  performed_by uuid references public.profiles(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  front_image_path text,
  side_image_path text,
  front_keypoints jsonb,
  side_keypoints jsonb,
  calibration_data jsonb,
  error_message text,
  created_at timestamptz default now(),
  completed_at timestamptz
);

alter table public.scans enable row level security;

create policy "Trainers can read their org scans"
  on public.scans for select
  using (
    org_id in (select org_id from public.org_members where user_id = auth.uid())
  );

create policy "Trainers can manage their org scans"
  on public.scans for all
  using (
    org_id in (select org_id from public.org_members where user_id = auth.uid())
  );

create policy "Clients can read own scans"
  on public.scans for select
  using (
    client_id in (select id from public.clients where user_id = auth.uid())
  );

-- ============================================================
-- Measurements
-- ============================================================
create table public.measurements (
  id uuid primary key default uuid_generate_v4(),
  scan_id uuid references public.scans(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  neck_cm numeric,
  chest_cm numeric,
  left_bicep_cm numeric,
  right_bicep_cm numeric,
  waist_cm numeric,
  hips_cm numeric,
  left_thigh_cm numeric,
  right_thigh_cm numeric,
  left_calf_cm numeric,
  right_calf_cm numeric,
  shoulders_cm numeric,
  left_forearm_cm numeric,
  right_forearm_cm numeric,
  wrist_cm numeric,
  body_fat_pct numeric,
  body_fat_navy numeric,
  body_fat_cunbae numeric,
  lean_mass_kg numeric,
  fat_mass_kg numeric,
  bmi numeric,
  waist_hip_ratio numeric,
  confidence_score numeric not null default 0,
  created_at timestamptz default now()
);

alter table public.measurements enable row level security;

create policy "Trainers can read their org measurements"
  on public.measurements for select
  using (
    client_id in (
      select id from public.clients
      where org_id in (select org_id from public.org_members where user_id = auth.uid())
    )
  );

create policy "Trainers can insert measurements"
  on public.measurements for insert
  with check (
    client_id in (
      select id from public.clients
      where org_id in (select org_id from public.org_members where user_id = auth.uid())
    )
  );

create policy "Clients can read own measurements"
  on public.measurements for select
  using (
    client_id in (select id from public.clients where user_id = auth.uid())
  );

-- ============================================================
-- Goals
-- ============================================================
create table public.goals (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references public.clients(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete cascade,
  metric text not null,
  target_value numeric not null,
  direction text not null check (direction in ('increase', 'decrease', 'maintain')),
  deadline date,
  achieved_at timestamptz,
  created_at timestamptz default now()
);

alter table public.goals enable row level security;

create policy "Trainers can manage goals"
  on public.goals for all
  using (
    org_id in (select org_id from public.org_members where user_id = auth.uid())
  );

create policy "Clients can read own goals"
  on public.goals for select
  using (
    client_id in (select id from public.clients where user_id = auth.uid())
  );

-- ============================================================
-- Scan Comparisons
-- ============================================================
create table public.scan_comparisons (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references public.clients(id) on delete cascade,
  scan_a_id uuid references public.scans(id) on delete cascade,
  scan_b_id uuid references public.scans(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz default now()
);

alter table public.scan_comparisons enable row level security;

create policy "Trainers can manage comparisons"
  on public.scan_comparisons for all
  using (
    client_id in (
      select id from public.clients
      where org_id in (select org_id from public.org_members where user_id = auth.uid())
    )
  );

-- ============================================================
-- Indexes
-- ============================================================
create index idx_clients_org_id on public.clients(org_id);
create index idx_clients_user_id on public.clients(user_id);
create index idx_scans_client_id on public.scans(client_id);
create index idx_scans_org_id on public.scans(org_id);
create index idx_measurements_scan_id on public.measurements(scan_id);
create index idx_measurements_client_id on public.measurements(client_id);
create index idx_goals_client_id on public.goals(client_id);
create index idx_org_members_user_id on public.org_members(user_id);
create index idx_org_members_org_id on public.org_members(org_id);

-- ============================================================
-- Storage Buckets
-- ============================================================
insert into storage.buckets (id, name, public) values ('scan-images', 'scan-images', false);
insert into storage.buckets (id, name, public) values ('scan-processed', 'scan-processed', false);
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', false);
insert into storage.buckets (id, name, public) values ('exports', 'exports', false);
insert into storage.buckets (id, name, public) values ('profile-images', 'profile-images', true);

-- Storage policies
create policy "Authenticated users can upload scan images"
  on storage.objects for insert
  with check (bucket_id = 'scan-images' and auth.role() = 'authenticated');

create policy "Users can read scan images from their org"
  on storage.objects for select
  using (bucket_id = 'scan-images' and auth.role() = 'authenticated');
