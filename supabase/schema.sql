-- ============================================================
-- منصة اختبارات مادة البرمجة - بكالوريا مصرية
-- ملف إنشاء قاعدة البيانات الكامل
-- طريقة الاستخدام: افتح Supabase Dashboard -> SQL Editor -> الصق الملف كامل -> Run
-- ============================================================

-- تفعيل توليد الـ UUID
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1) جدول الدروس (Lessons)
-- ------------------------------------------------------------
create table if not exists lessons (
  id uuid primary key default gen_random_uuid(),
  grade smallint not null check (grade in (1,2)),   -- 1 = أولى ثانوي، 2 = تانية ثانوي
  title text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 2) جدول الأسئلة (Questions) - حساس: مفيش وصول مباشر له من المتصفح
-- ------------------------------------------------------------
create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  type text not null check (type in ('mcq','essay')),
  question_text text not null,
  options jsonb,              -- للاختياري فقط: [{"id":"a","text":"..."},{"id":"b","text":"..."}]
  correct_option text,        -- للاختياري فقط: "a" أو "b" ... إلخ
  model_answer text,          -- للمقالي فقط: إجابة نموذجية يسترشد بيها الذكاء الاصطناعي في التصحيح
  max_score numeric not null default 1,
  sort_order int not null default 0
);

-- ------------------------------------------------------------
-- 3) جدول قايمة الطلبة المعتمدة (Roster) - حساس
-- ------------------------------------------------------------
create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  grade smallint not null check (grade in (1,2)),
  created_at timestamptz default now(),
  unique (name, grade)
);

-- ------------------------------------------------------------
-- 4) جدول محاولات الاختبار (Attempts) - حساس
-- ------------------------------------------------------------
create table if not exists attempts (
  id uuid primary key default gen_random_uuid(),
  student_name text not null,
  grade smallint not null,
  lesson_id uuid not null references lessons(id),
  status text not null default 'in_progress' check (status in ('in_progress','submitted')),
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  duration_seconds int,
  total_score numeric,
  max_score numeric,
  answers jsonb   -- [{question_id, type, student_answer, score, max_score, feedback}]
);

-- يمنع الطالب من تسليم نفس الدرس مرتين
create unique index if not exists attempts_one_submission
  on attempts (student_name, grade, lesson_id)
  where status = 'submitted';

-- ------------------------------------------------------------
-- 5) تفعيل الحماية على مستوى الصفوف (RLS) على كل الجداول
-- ------------------------------------------------------------
alter table lessons  enable row level security;
alter table questions enable row level security;
alter table students enable row level security;
alter table attempts enable row level security;

-- الدروس فقط هي المسموح بقرائتها مباشرة من المتصفح (العنوان بس، مفيش أسئلة)
drop policy if exists "public read active lessons" on lessons;
create policy "public read active lessons"
  on lessons for select
  using (is_active = true);

-- questions / students / attempts: مفيش أي policy = صفر وصول من المفتاح العام (anon)
-- الوصول الوحيد ليهم هيكون من الـ Edge Functions اللي بتستخدم الـ service_role key

-- ============================================================
-- بيانات تجريبية للاختبار (اختياري - امسح السطور دي لو مش عايزها)
-- ============================================================
insert into lessons (grade, title, sort_order) values
  (1, 'مقدمة في البرمجة ولغة بايثون', 1),
  (1, 'المتغيرات وأنواع البيانات', 2)
on conflict do nothing;
