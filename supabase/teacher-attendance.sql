-- منظومة عَون: سجل حضور المعلمين
-- شغّل هذا الملف مرة واحدة في Supabase SQL Editor.
create table if not exists public.teacher_attendance (
 id uuid primary key default gen_random_uuid(),
 client_operation_id uuid not null unique,
 teacher_id uuid not null references public.profiles(id) on delete restrict,
 attendance_date date not null,
 status text not null check (status in ('present','absent')),
 notes text,
 created_by uuid not null references public.profiles(id) on delete restrict,
 created_at timestamptz not null default now(),
 constraint teacher_attendance_teacher_date_unique unique(teacher_id,attendance_date)
);
create index if not exists teacher_attendance_date_idx on public.teacher_attendance(attendance_date desc);
create index if not exists teacher_attendance_teacher_idx on public.teacher_attendance(teacher_id,attendance_date desc);
alter table public.teacher_attendance enable row level security;
revoke all on public.teacher_attendance from anon, authenticated;
