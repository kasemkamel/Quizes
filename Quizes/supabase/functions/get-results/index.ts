// GET /get-results   Header: x-dashboard-password
// بيرجع كل نتايج الطلبة المُسلَّمة - محمي بكلمة سر بسيطة (اضبطها في Secrets باسم DASHBOARD_PASSWORD)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-dashboard-password",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const providedPassword = req.headers.get("x-dashboard-password");
  const realPassword = Deno.env.get("DASHBOARD_PASSWORD");

  if (!realPassword || providedPassword !== realPassword) {
    return new Response(JSON.stringify({ error: "كلمة السر غير صحيحة" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase
      .from("attempts")
      .select("id, student_name, grade, lesson_id, status, submitted_at, duration_seconds, total_score, max_score, answers, lessons(title)")
      .eq("status", "submitted")
      .order("submitted_at", { ascending: false });

    if (error) throw error;

    return new Response(JSON.stringify({ attempts: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
