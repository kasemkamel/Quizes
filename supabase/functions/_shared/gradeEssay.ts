// ============================================================
// تصحيح الأسئلة المقالية بالذكاء الاصطناعي
// يجرب بالترتيب: Gemini -> Groq -> OpenRouter -> تصحيح احتياطي بمطابقة كلمات مفتاحية
// كل مفاتيح الـ API بتتقرا من الـ Secrets (متبقاش مكتوبة هنا أبدًا)
// ============================================================

interface GradeResult {
  score: number;
  feedback: string;
  gradedBy: string; // اسم المزود اللي نجح، أو "fallback_keywords"
  errors?: string[]; // أسباب فشل المزودين (للتشخيص)
}

function buildPrompt(question: string, modelAnswer: string, studentAnswer: string, maxScore: number) {
  return `أنت مُدرِّس مادة حاسب آلي بتصحح إجابة طالب في مرحلة الثانوية العامة المصرية (بكالوريا).
السؤال: ${question}
الإجابة النموذجية (للاسترشاد فقط، مش لازم تطابق حرفيًا): ${modelAnswer}
إجابة الطالب: ${studentAnswer}
الدرجة القصوى لهذا السؤال: ${maxScore}

قيّم إجابة الطالب بعدل وبناءً على الفهم مش الحفظ الحرفي، وارجع بالتنسيق JSON التالي فقط بدون أي نص إضافي قبله أو بعده:
{"score": <رقم من 0 إلى ${maxScore}>, "feedback": "<جملة أو اتنين بالعربي توضح للطالب نقاط القوة والضعف في إجابته>"}`;
}

function parseModelJson(raw: unknown, maxScore: number): { score: number; feedback: string } | null {
  try {
    const text = typeof raw === "string" ? raw : JSON.stringify(raw ?? "");
    // بعض الموديلات بترجع الـ JSON جوه ```json ... ``` فبنشيلهم لو موجودين
    const cleaned = text.replace(/```json|```/g, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    let score = Number(parsed.score);
    if (isNaN(score)) return null;
    score = Math.max(0, Math.min(maxScore, score));
    const feedback = String(parsed.feedback ?? "").slice(0, 500);
    return { score, feedback };
  } catch {
    return null;
  }
}

// ---------- Gemini ----------
async function tryGemini(prompt: string, maxScore: number): Promise<GradeResult | null> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  const model = Deno.env.get("GEMINI_MODEL") || "gemini-3.5-flash-lite";
  if (!apiKey) throw new Error("gemini: GEMINI_API_KEY غير مضبوط");
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2 },
        }),
      }
    );
    if (!res.ok) throw new Error(`gemini: HTTP ${res.status} ${(await res.text()).slice(0,200)}`);
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("gemini: رد فاضي");
    const parsed = parseModelJson(text, maxScore);
    if (!parsed) throw new Error("gemini: تعذر قراءة الرد كـ JSON: " + text.slice(0,120));
    return { ...parsed, gradedBy: "gemini" };
  } catch (e) {
    throw e instanceof Error ? e : new Error("gemini: " + String(e));
  }
}

// ---------- Groq (متوافق مع OpenAI API) ----------
async function tryGroq(prompt: string, maxScore: number): Promise<GradeResult | null> {
  const apiKey = Deno.env.get("GROQ_API_KEY");
  const model = Deno.env.get("GROQ_MODEL") || "openai/gpt-oss-120b";
  if (!apiKey) throw new Error("groq: GROQ_API_KEY غير مضبوط");
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      }),
    });
    if (!res.ok) throw new Error(`groq: HTTP ${res.status} ${(await res.text()).slice(0,200)}`);
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error("groq: رد فاضي");
    const parsed = parseModelJson(text, maxScore);
    if (!parsed) throw new Error("groq: تعذر قراءة الرد كـ JSON: " + text.slice(0,120));
    return { ...parsed, gradedBy: "groq" };
  } catch (e) {
    throw e instanceof Error ? e : new Error("groq: " + String(e));
  }
}

// ---------- Cloudflare Workers AI (متوافقة، ومجانية 100% بدون أي بطاقة ائتمان) ----------
async function tryCloudflare(prompt: string, maxScore: number): Promise<GradeResult | null> {
  const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID");
  const apiToken = Deno.env.get("CLOUDFLARE_API_TOKEN");
  const model = Deno.env.get("CLOUDFLARE_MODEL") || "@cf/meta/llama-3.1-8b-instruct";
  if (!accountId || !apiToken) throw new Error("cloudflare: CLOUDFLARE_ACCOUNT_ID/API_TOKEN غير مضبوطين");
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2,
        }),
      }
    );
    if (!res.ok) throw new Error(`cloudflare: HTTP ${res.status} ${(await res.text()).slice(0,200)}`);
    const data = await res.json();
    const raw = data?.result?.response ?? data?.result?.choices?.[0]?.message?.content;
    if (!raw) throw new Error("cloudflare: رد فاضي");
    const parsed = parseModelJson(raw, maxScore);
    if (!parsed) throw new Error("cloudflare: تعذر قراءة الرد كـ JSON: " + JSON.stringify(raw).slice(0,120));
    return { ...parsed, gradedBy: "cloudflare" };
  } catch (e) {
    throw e instanceof Error ? e : new Error("cloudflare: " + String(e));
  }
}

// ---------- تصحيح احتياطي أخير: مطابقة كلمات مفتاحية ----------
function keywordFallback(modelAnswer: string, studentAnswer: string, maxScore: number, errors: string[]): GradeResult {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter((w) => w.length > 2);
  const modelWords = new Set(normalize(modelAnswer || ""));
  const studentWords = new Set(normalize(studentAnswer || ""));
  if (modelWords.size === 0 || studentWords.size === 0) {
    return { score: 0, feedback: "تعذر التصحيح الآلي، هذه الإجابة تحتاج مراجعة يدوية من المعلم.", gradedBy: "fallback_keywords", errors };
  }
  let overlap = 0;
  for (const w of modelWords) if (studentWords.has(w)) overlap++;
  const ratio = overlap / modelWords.size;
  const score = Math.round(ratio * maxScore * 10) / 10;
  return {
    score,
    feedback: "تم التصحيح مؤقتًا بمطابقة الكلمات المفتاحية لعدم توفر خدمة الذكاء الاصطناعي حاليًا، يُفضّل مراجعة المعلم لهذه الإجابة.",
    gradedBy: "fallback_keywords",
    errors,
  };
}

export async function gradeEssayAnswer(
  question: string,
  modelAnswer: string,
  studentAnswer: string,
  maxScore: number
): Promise<GradeResult> {
  const prompt = buildPrompt(question, modelAnswer || "", studentAnswer || "", maxScore);

  const providers = [tryGemini, tryGroq, tryCloudflare];
  const errors: string[] = [];
  for (const provider of providers) {
    try {
      const result = await provider(prompt, maxScore);
      if (result) return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(msg);
      console.error("AI provider failed:", msg);
    }
  }
  return keywordFallback(modelAnswer || "", studentAnswer || "", maxScore, errors);
}
