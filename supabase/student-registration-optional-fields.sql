-- Allow creating a student record before all details are available.
-- Existing student data is preserved.
alter table public.students
  alter column first_name drop not null,
  alter column last_name drop not null,
  alter column guardian_id drop not null;
