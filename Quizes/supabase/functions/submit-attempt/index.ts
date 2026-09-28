// POST /submit-attempt   body: { attempt_id, answers: [{question_id, value}], duration_seconds }
// بيجيب الأسئلة الحقيقية بإجاباتها من قاعدة البيانات (مش من المتصفح) عشان محدش يقدر يغش
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { gradeEssayAnswer } from "../_shared/gradeEssay.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { attempt_id, answers, duration_seconds } = await req.json();
    if (!attempt_id || !Array.isArray(answers)) {
      return new Response(JSON.stringify({ error: "بيانات ناقصة" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: attempt, error: attErr } = await supabase
      .from("attempts")
      .select("id, lesson_id, status")
      .eq("id", attempt_id)
      .single();

    if (attErr || !attempt) throw new Error("المحاولة غير موجودة");
    if (attempt.status === "submitted") {
      return new Response(JSON.stringify({ error: "تم تسليم هذا الاختبار بالفعل" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: questions, error: qErr } = await supabase
      .from("questions")
      .select("id, type, question_text, correct_option, model_answer, max_score")
      .eq("lesson_id", attempt.lesson_id);

    if (qErr) throw qErr;

    const questionMap = new Map(questions.map((q) => [q.id, q]));
    const gradedAnswers = [];
    let totalScore = 0;
    let totalMax = 0;

    for (const ans of answers) {
      const q = questionMap.get(ans.question_id);
      if (!q) continue;
      totalMax += Number(q.max_score);

      if (q.type === "mcq") {
        const isCorrect = ans.value === q.correct_option;
        const score = isCorrect ? Number(q.max_score) : 0;
        totalScore += score;
        gradedAnswers.push({
          question_id: q.id,
          type: "mcq",
          student_answer: ans.value,
          score,
          max_score: q.max_score,
          feedback: isCorrect ? "إجابة صحيحة" : "إجابة غير صحيحة",
        });
      } else {
        const result = await gradeEssayAnswer(
          q.question_text,
          q.model_answer || "",
          ans.value || "",
          Number(q.max_score)
        );
        totalScore += result.score;
        gradedAnswers.push({
          question_id: q.id,
          type: "essay",
          student_answer: ans.value,
          score: result.score,
          max_score: q.max_score,
          feedback: result.feedback,
          graded_by: result.gradedBy,
        });
      }
    }

    const { error: updateErr } = await supabase
      .from("attempts")
      .update({
        status: "submitted",
        submitted_at: new Date().toISOString(),
        duration_seconds: duration_seconds || null,
        total_score: totalScore,
        max_score: totalMax,
        answers: gradedAnswers,
      })
      .eq("id", attempt_id);

    if (updateErr) throw updateErr;

    return new Response(
      JSON.stringify({ total_score: totalScore, max_score: totalMax, answers: gradedAnswers }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
