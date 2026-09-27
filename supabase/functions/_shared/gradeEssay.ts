// ============================================================
// تصحيح الأسئلة المقالية بالذكاء الاصطناعي
// يجرب بالترتيب: Gemini -> Groq -> OpenRouter -> تصحيح احتياطي بمطابقة كلمات مفتاحية
// كل مفاتيح الـ API بتتقرا من الـ Secrets (متبقاش مكتوبة هنا أبدًا)
// ============================================================

interface GradeResult {
  score: number;
  feedback: string;
  gradedBy: string; // اسم المزود اللي نجح، أو "fallback_keywords"
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

function parseModelJson(text: string, maxScore: number): { score: number; feedback: string } | null {
  try {
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
  const model = Deno.env.get("GEMINI_MODEL") || "gemini-2.0-flash-lite";
  if (!apiKey) return null;
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
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    const parsed = parseModelJson(text, maxScore);
    return parsed ? { ...parsed, gradedBy: "gemini" } : null;
  } catch {
    return null;
  }
}

// ---------- Groq (متوافق مع OpenAI API) ----------
async function tryGroq(prompt: string, maxScore: number): Promise<GradeResult | null> {
  const apiKey = Deno.env.get("GROQ_API_KEY");
  const model = Deno.env.get("GROQ_MODEL") || "llama-3.3-70b-versatile";
  if (!apiKey) return null;
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
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) return null;
    const parsed = parseModelJson(text, maxScore);
    return parsed ? { ...parsed, gradedBy: "groq" } : null;
  } catch {
    return null;
  }
}

// ---------- OpenRouter (متوافق مع OpenAI API) ----------
async function tryOpenRouter(prompt: string, maxScore: number): Promise<GradeResult | null> {
  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  const model = Deno.env.get("OPENROUTER_MODEL") || "meta-llama/llama-3.1-8b-instruct:free";
  if (!apiKey) return null;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) return null;
    const parsed = parseModelJson(text, maxScore);
    return parsed ? { ...parsed, gradedBy: "openrouter" } : null;
  } catch {
    return null;
  }
}

// ---------- تصحيح احتياطي أخير: مطابقة كلمات مفتاحية ----------
function keywordFallback(modelAnswer: string, studentAnswer: string, maxScore: number): GradeResult {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter((w) => w.length > 2);
  const modelWords = new Set(normalize(modelAnswer || ""));
  const studentWords = new Set(normalize(studentAnswer || ""));
  if (modelWords.size === 0 || studentWords.size === 0) {
    return { score: 0, feedback: "تعذر التصحيح الآلي، هذه الإجابة تحتاج مراجعة يدوية من المعلم.", gradedBy: "fallback_keywords" };
  }
  let overlap = 0;
  for (const w of modelWords) if (studentWords.has(w)) overlap++;
  const ratio = overlap / modelWords.size;
  const score = Math.round(ratio * maxScore * 10) / 10;
  return {
    score,
    feedback: "تم التصحيح مؤقتًا بمطابقة الكلمات المفتاحية لعدم توفر خدمة الذكاء الاصطناعي حاليًا، يُفضّل مراجعة المعلم لهذه الإجابة.",
    gradedBy: "fallback_keywords",
  };
}

export async function gradeEssayAnswer(
  question: string,
  modelAnswer: string,
  studentAnswer: string,
  maxScore: number
): Promise<GradeResult> {
  const prompt = buildPrompt(question, modelAnswer || "", studentAnswer || "", maxScore);

  const providers = [tryGemini, tryGroq, tryOpenRouter];
  for (const provider of providers) {
    const result = await provider(prompt, maxScore);
    if (result) return result;
  }
  return keywordFallback(modelAnswer || "", studentAnswer || "", maxScore);
}
