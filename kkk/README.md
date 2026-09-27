# منصة اختبارات مادة البرمجة - بكالوريا مصرية

نظام اختبارات مجاني بالكامل: تصحيح تلقائي فوري (اختياري + مقالي بالذكاء الاصطناعي)، مؤقت، وتجميع النتائج في لوحة معلم واحدة.

**التكلفة: صفر جنيه.** (Supabase مجاني + GitHub Pages مجاني + مفاتيح AI مجانية).

---

## الخطوة 1: إنشاء مشروع Supabase (5 دقائق)

1. روح [supabase.com](https://supabase.com) واعمل حساب مجاني.
2. اعمل **New Project** (اختار أي باسورد لقاعدة البيانات واحفظه).
3. من القائمة الجانبية: **SQL Editor** → **New query**.
4. افتح ملف `supabase/schema.sql` من المشروع ده، انسخ محتواه كامل، الصقه، واضغط **Run**.
   - ده هينشئ كل الجداول ويحمي الحساسة منها تلقائيًا.
5. (اختياري) كرر نفس الخطوة بملف `supabase/seed-example.sql` عشان تجرب بدرس وأسئلة حقيقية.

## الخطوة 2: ربط الموقع بمشروعك

1. من **Project Settings → API**، هتلاقي:
   - **Project URL**
   - **anon public key**
2. افتح ملف `assets/config.js` وحط القيمتين دول مكان الأماكن الفاضية.

## الخطوة 3: مفاتيح الذكاء الاصطناعي (مجانية 100%، بدون أي بطاقة ائتمان)

1. **Gemini**: اعمل حساب مجاني واحصل على مفتاح من https://aistudio.google.com/app/apikey
2. **Groq**: اعمل حساب مجاني واحصل على مفتاح من https://console.groq.com/keys
3. **Cloudflare Workers AI** (بدل OpenRouter - أوضح وأضمن كمجانية بدون بطاقة):
   - اعمل حساب مجاني على https://dash.cloudflare.com
   - من الصفحة الرئيسية للوحة التحكم، هتلاقي **Account ID** في الشريط الجانبي الأيمن — انسخه.
   - روح **My Profile → API Tokens → Create Token**، اختار **Custom Token**، وادّيله صلاحية **Workers AI → Read**، واحفظ التوكن الناتج.
   - محتاج القيمتين دول: `CLOUDFLARE_ACCOUNT_ID` و `CLOUDFLARE_API_TOKEN`.

## الخطوة 4: نشر الدوال الخفية (Edge Functions)

على جهازك، افتح Terminal في مجلد المشروع ونفذ (مش محتاج تثبيت حاجة، `npx` هيحمل الأداة تلقائيًا):

```bash
npx supabase login
npx supabase link --project-ref YOUR-PROJECT-REF
```

(هتلاقي `YOUR-PROJECT-REF` في رابط مشروعك على Supabase، أو في نفس صفحة API).

بعد كده حط أسرارك (المفاتيح متتخزنش في الكود خالص):

```bash
npx supabase secrets set GEMINI_API_KEY=xxxxx
npx supabase secrets set GROQ_API_KEY=xxxxx
npx supabase secrets set CLOUDFLARE_ACCOUNT_ID=xxxxx
npx supabase secrets set CLOUDFLARE_API_TOKEN=xxxxx
npx supabase secrets set DASHBOARD_PASSWORD=اختر_كلمة_سر_قوية_هنا
```

وانشر الدوال الأربعة:

```bash
npx supabase functions deploy get-quiz --no-verify-jwt
npx supabase functions deploy start-attempt --no-verify-jwt
npx supabase functions deploy submit-attempt --no-verify-jwt
npx supabase functions deploy get-results --no-verify-jwt
```

> **ملاحظة:** `SUPABASE_URL` و `SUPABASE_SERVICE_ROLE_KEY` بيتحطوا تلقائيًا من Supabase نفسه جوه بيئة الدوال، مش محتاج تحطهم يدويًا.

## الخطوة 5: النشر على GitHub Pages (مجاني)

1. اعمل repository جديد على GitHub وارفع عليه كل ملفات المشروع.
2. من إعدادات الـ repo: **Settings → Pages** → اختار **Deploy from branch** → **main** → **/ (root)** → **Save**.
3. بعد دقيقة أو اتنين، هيديك لينك زي:
   `https://your-username.github.io/repo-name/`

هنا بقى عندك لينكين تشاركهم:
- `.../index.html` (أو الرابط الرئيسي) → صفحة اختيار السنة.
- `.../dashboard.html` → لوحة المعلم (محمية بكلمة السر اللي حطيتها في الخطوة 4).

---

## إضافة دروس وأسئلة جديدة (بنك الأسئلة)

افتح `supabase/seed-example.sql` كقالب، عدّل النصوص، والصقه في **SQL Editor** بتاع Supabase وشغّله. تقدر تطلب مني في أي وقت أجهزلك أسئلة جاهزة لأي درس وهبعتهالك بنفس الصيغة.

## إدارة قايمة الطلبة المسموح لهم (Roster)

- لو جدول `students` **فاضي تمامًا**: أي اسم يقدر يدخل (وضع "الاسم فقط").
- لو ضفت أسماء فيه: بس الأسماء دي (بنفس الصف) تقدر تبدأ الاختبار، ومحدش يقدر يسلّم نفس الدرس مرتين.

إضافة طلبة:
```sql
insert into students (name, grade) values
  ('اسم الطالب', 1);
```

## أمان مهم

- مفتاح `anon` العام آمن يتحط في الكود (مصمم عشان كده)، لكن **متحطش أبدًا** الـ `service_role key` في أي ملف بيترفع لـ GitHub.
- الأسئلة والإجابات الصحيحة وقايمة الطلبة **مش متاحين للمتصفح خالص** — بيتشافوا فقط جوه الدوال الخفية.
