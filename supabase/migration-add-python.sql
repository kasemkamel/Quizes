-- شغّل الملف ده مرة واحدة في Supabase SQL Editor عشان يقبل مسار بايثون (grade = 3)
alter table lessons  drop constraint if exists lessons_grade_check;
alter table lessons  add  constraint lessons_grade_check  check (grade in (1,2,3));

alter table students drop constraint if exists students_grade_check;
alter table students add  constraint students_grade_check check (grade in (1,2,3));

-- مثال: إضافة درس بايثون
-- insert into lessons (grade, title, sort_order) values (3, 'أساسيات بايثون', 1);
