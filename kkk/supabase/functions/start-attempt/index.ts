// POST /start-attempt   body: { student_name, grade, lesson_id }
// بيتحقق من قايمة الطلبة المعتمدة (roster) ومن عدم وجود محاولة سابقة مُسلَّمة، وبيفتح محاولة جديدة
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { student_name, grade, lesson_id } = await req.json();

    if (!student_name?.trim() || !grade || !lesson_id) {
      return new Response(JSON.stringify({ error: "بيانات ناقصة" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // هل تفعيل قايمة الطلبة المعتمدة مفعّل؟ (لو الجدول فاضي، بنسمح لأي اسم - وضع "الاسم فقط")
    const { count } = await supabase
      .from("students")
      .select("*", { count: "exact", head: true })
      .eq("grade", grade);

    if (count && count > 0) {
      const { data: match } = await supabase
        .from("students")
        .select("id")
        .ilike("name", student_name.trim())
        .eq("grade", grade)
        .maybeSingle();

      if (!match) {
        return new Response(
          JSON.stringify({ error: "الاسم غير موجود في قايمة الطلبة المسجلين لهذا الصف" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // امنع تسليم نفس الدرس مرتين
    const { data: prevSubmitted } = await supabase
      .from("attempts")
      .select("id")
      .eq("student_name", student_name.trim())
      .eq("grade", grade)
      .eq("lesson_id", lesson_id)
      .eq("status", "submitted")
      .maybeSingle();

    if (prevSubmitted) {
      return new Response(
        JSON.stringify({ error: "لقد قمت بتسليم هذا الاختبار من قبل" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: attempt, error } = await supabase
      .from("attempts")
      .insert({ student_name: student_name.trim(), grade, lesson_id, status: "in_progress" })
      .select("id, started_at")
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ attempt_id: attempt.id, started_at: attempt.started_at }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
