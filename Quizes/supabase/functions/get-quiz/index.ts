// GET /get-quiz?lesson_id=xxxx
// بيرجع أسئلة الدرس للطالب بدون الإجابة الصح أو الإجابة النموذجية
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const lessonId = url.searchParams.get("lesson_id");
    if (!lessonId) {
      return new Response(JSON.stringify({ error: "lesson_id مطلوب" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: lesson, error: lessonErr } = await supabase
      .from("lessons")
      .select("id, title, grade")
      .eq("id", lessonId)
      .single();

    if (lessonErr || !lesson) {
      return new Response(JSON.stringify({ error: "الدرس غير موجود" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: questions, error: qErr } = await supabase
      .from("questions")
      .select("id, type, question_text, options, max_score, sort_order")
      .eq("lesson_id", lessonId)
      .order("sort_order", { ascending: true });

    if (qErr) throw qErr;

    return new Response(JSON.stringify({ lesson, questions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
