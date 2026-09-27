-- ============================================================
-- مثال: إزاي تضيف درس جديد + أسئلته (بنك الأسئلة)
-- انسخ اللي تحت، عدّل النصوص، والصقه في Supabase SQL Editor واضغط Run
-- ============================================================

-- 1) أضف الدرس (لو مش موجود أصلاً)
insert into lessons (grade, title, sort_order)
values (1, 'الجمل الشرطية (if/else)', 3)
on conflict do nothing;

-- 2) أضف الأسئلة، وبنربطها بالدرس عن طريق العنوان
with target_lesson as (
  select id from lessons where title = 'الجمل الشرطية (if/else)' and grade = 1 limit 1
)
insert into questions (lesson_id, type, question_text, options, correct_option, model_answer, max_score, sort_order)
select id, 'mcq',
  'أي جملة من دول بتستخدم للتحقق من شرط في بايثون؟',
  '[{"id":"a","text":"for"},{"id":"b","text":"if"},{"id":"c","text":"print"},{"id":"d","text":"def"}]'::jsonb,
  'b', null, 1, 1
from target_lesson
union all
select id, 'essay',
  'اشرح الفرق بين elif و else في لغة بايثون مع مثال بسيط.',
  null, null,
  'elif بتفحص شرط جديد مختلف لو الشرط الأول غلط، أما else فبتنفذ لو كل الشروط اللي قبلها غلط من غير ما تفحص شرط جديد. مثال: if x>10: ... elif x>5: ... else: ...',
  3, 2
from target_lesson;

-- ------------------------------------------------------------
-- إضافة طلبة لقايمة المسموح لهم بالدخول (Roster)
-- ------------------------------------------------------------
insert into students (name, grade) values
  ('أحمد محمد علي', 1),
  ('سارة إبراهيم', 1)
on conflict do nothing;
