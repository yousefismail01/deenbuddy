
# Deen Tracker (Angular 18 + Supabase + Tailwind)

A beautiful, mobile-first 40-day deen tracker with login, per-user cloud storage, PWA, and one-click export.

## Quick start

1. **Install Angular CLI**  
   ```bash
   npm i -g @angular/cli
   ```

2. **Install deps**  
   ```bash
   npm i
   ```

3. **Tailwind is already configured** (no extra steps).

4. **Supabase env**  
   Edit `src/environments/environment.ts` with your `supabaseUrl` and `supabaseAnonKey`.

5. **Supabase SQL (run in Supabase SQL editor)**

   ```sql
   create table if not exists public.profiles (
     id uuid primary key references auth.users(id) on delete cascade,
     display_name text,
     created_at timestamptz default now()
   );

   create table if not exists public.rounds (
     id uuid primary key default gen_random_uuid(),
     user_id uuid not null references public.profiles(id) on delete cascade,
     title text default '40-Day Plan',
     start_date date not null default current_date,
     is_active boolean not null default true,
     created_at timestamptz default now()
   );

   create unique index if not exists uq_rounds_user_active
     on public.rounds(user_id) where (is_active);

   create table if not exists public.day_records (
     id uuid primary key default gen_random_uuid(),
     round_id uuid not null references public.rounds(id) on delete cascade,
     day_number int not null check (day_number between 1 and 40),
     data jsonb not null,
     updated_at timestamptz default now(),
     unique (round_id, day_number)
   );

   alter table public.profiles enable row level security;
   alter table public.rounds enable row level security;
   alter table public.day_records enable row level security;

   create policy "profiles_select_own" on public.profiles
   for select using (auth.uid() = id);

   create policy "profiles_upsert_own" on public.profiles
   for insert with check (auth.uid() = id);

   create policy "profiles_update_own" on public.profiles
   for update using (auth.uid() = id);

   create policy "rounds_crud_own" on public.rounds
   for all using (auth.uid() = user_id)
   with check (auth.uid() = user_id);

   create policy "days_crud_own" on public.day_records
   for all using (
     exists (select 1 from public.rounds r where r.id = round_id and r.user_id = auth.uid())
   )
   with check (
     exists (select 1 from public.rounds r where r.id = round_id and r.user_id = auth.uid())
   );
   ```

6. **Run**  
   ```bash
   npm start
   ```
   App on http://localhost:4200

## Features
- Magic link or Google login
- Secure per-user storage (Supabase RLS)
- 40-day grid with tap-friendly toggles
- Tailwind design + Material harmony
- PWA-ready, offline-friendly
- Export JSON/CSV

---

_Produced as a starter template. Customize weights and UI in `src/app/data/scoring.model.ts` and `dashboard.component.html`._
