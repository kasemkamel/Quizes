// ============================================================
// منطق صفحة الاختبار
// ============================================================
const app = document.getElementById("app");
const tabFilename = document.getElementById("tabFilename");
const tabDot = document.getElementById("tabDot");

const params = new URLSearchParams(location.search);
const GRADE = Number(params.get("grade")) || 1;
const GRADE_NAMES = { 1: "أولى ثانوي", 2: "تانية ثانوي", 3: "بايثون" };

const SECONDS_PER_QUESTION = 90;
const MIN_SECONDS = 300;

let state = {
  lessons: [],
  lessonId: null,
  studentName: "",
  attemptId: null,
  questions: [],
  currentIndex: 0,
  answers: {},        // {question_id: value}
  totalSeconds: 0,
  remaining: 0,
  timerHandle: null,
  startTime: null,
};

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

async function restGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: authHeaders() });
  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json()).message || ""; } catch {}
    throw new Error(`HTTP ${res.status} ${detail}`);
  }
  return res.json();
}

async function callFunction(name, { method = "POST", body, headers = {} } = {}) {
  const res = await fetch(`${FUNCTIONS_URL}/${name}`, {
    method,
    headers: authHeaders({ "Content-Type": "application/json", ...headers }),
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "حدث خطأ غير متوقع");
  return data;
}

// ---------------- شاشة 1: اختيار الدرس وإدخال الاسم ----------------
async function renderStartScreen() {
  tabFilename.textContent = GRADE === 3 ? "python.py" : `grade_${GRADE}.py`;
  app.innerHTML = `<p class="mono" style="color:var(--text-muted)">... جاري تحميل الدروس</p>`;

  try {
    state.lessons = await restGet(`lessons?grade=eq.${GRADE}&is_active=eq.true&order=sort_order.asc&select=id,title`);
  } catch (e) {
    app.innerHTML = `<div class="error-box">تعذر تحميل الدروس. تأكد من إعداد الاتصال بقاعدة البيانات.<br><small class="mono" style="direction:ltr;display:block;margin-top:.5rem">${escapeHtml(e.message)}</small></div>`;
    return;
  }

  if (state.lessons.length === 0) {
    app.innerHTML = `<div class="error-box">لا توجد دروس متاحة لهذا الصف حاليًا.</div>`;
    return;
  }

  app.innerHTML = `
    <h2>ابدأ اختبارك</h2>
    <p style="margin:0 0 .5rem;">${GRADE_NAMES[GRADE] || ""}</p>
    <label for="studentName">اسمك بالكامل</label>
    <input type="text" id="studentName" placeholder="مثال: أحمد محمد علي" />

    <label for="lessonSelect">اختر الدرس</label>
    <select id="lessonSelect" style="width:100%; background:var(--panel-alt); border:1px solid var(--border); color:var(--text); padding:.75rem .9rem; border-radius:4px; font-family:inherit; font-size:1rem;">
      ${state.lessons.map((l) => `<option value="${l.id}">${escapeHtml(l.title)}</option>`).join("")}
    </select>

    <div id="startError"></div>
    <div style="margin-top:1.5rem;">
      <button id="startBtn">ابدأ الاختبار</button>
    </div>
  `;

  document.getElementById("startBtn").addEventListener("click", handleStart);
}

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function handleStart() {
  const nameInput = document.getElementById("studentName");
  const lessonSelect = document.getElementById("lessonSelect");
  const errBox = document.getElementById("startError");
  const btn = document.getElementById("startBtn");
  errBox.innerHTML = "";

  const name = nameInput.value.trim();
  if (!name) {
    errBox.innerHTML = `<div class="error-box">من فضلك اكتب اسمك</div>`;
    return;
  }

  btn.disabled = true;
  btn.textContent = "جاري التحقق...";

  try {
    const startRes = await callFunction("start-attempt", {
      body: { student_name: name, grade: GRADE, lesson_id: lessonSelect.value },
    });
    state.attemptId = startRes.attempt_id;
    state.studentName = name;
    state.lessonId = lessonSelect.value;

    const res = await fetch(`${FUNCTIONS_URL}/get-quiz?lesson_id=${state.lessonId}`, {
      headers: authHeaders(),
    });
    const quizData = await res.json();
    if (!res.ok) throw new Error(quizData.error || "تعذر تحميل الأسئلة");

    if (!quizData.questions || quizData.questions.length === 0) {
      throw new Error("لا توجد أسئلة في هذا الدرس بعد. اختر درسًا آخر.");
    }
    state.questions = shuffleArray(quizData.questions).map((q) => {
      if (q.type === "mcq" && Array.isArray(q.options)) {
        return { ...q, options: shuffleArray(q.options) };
      }
      return q;
    });
    state.currentIndex = 0;
    state.answers = {};
    state.totalSeconds = Math.max(MIN_SECONDS, state.questions.length * SECONDS_PER_QUESTION);
    state.remaining = state.totalSeconds;
    state.startTime = Date.now();

    tabFilename.textContent = `${quizData.lesson.title.replace(/\s+/g, "_")}.py`;
    tabDot.classList.add("running");

    startTimer();
    renderQuestion();
  } catch (e) {
    btn.disabled = false;
    btn.textContent = "ابدأ الاختبار";
    errBox.innerHTML = `<div class="error-box">${escapeHtml(e.message)}</div>`;
  }
}

// ---------------- المؤقت ----------------
function startTimer() {
  clearInterval(state.timerHandle);
  state.timerHandle = setInterval(() => {
    state.remaining--;
    updateTimerUI();
    if (state.remaining <= 0) {
      clearInterval(state.timerHandle);
      submitQuiz();
    }
  }, 1000);
}

function updateTimerUI() {
  const timerEl = document.getElementById("timerText");
  const fillEl = document.getElementById("progressFill");
  if (!timerEl) return;
  const m = Math.floor(state.remaining / 60).toString().padStart(2, "0");
  const s = (state.remaining % 60).toString().padStart(2, "0");
  timerEl.textContent = `${m}:${s}`;
  timerEl.classList.toggle("low", state.remaining <= 60);
  if (fillEl) fillEl.style.width = `${(state.remaining / state.totalSeconds) * 100}%`;
}

// ---------------- شاشة 2: عرض سؤال بسؤال ----------------
function renderQuestion() {
  const q = state.questions[state.currentIndex];
  const isLast = state.currentIndex === state.questions.length - 1;
  const savedAnswer = state.answers[q.id];

  let bodyHtml = "";
  if (q.type === "mcq") {
    bodyHtml = q.options
      .map(
        (opt) => `
      <label class="option-row ${savedAnswer === opt.id ? "selected" : ""}" data-opt="${opt.id}">
        <input type="radio" name="opt" value="${opt.id}" ${savedAnswer === opt.id ? "checked" : ""}>
        <span>${escapeHtml(opt.text)}</span>
      </label>`
      )
      .join("");
  } else {
    bodyHtml = `<textarea id="essayAnswer" placeholder="اكتب إجابتك هنا...">${escapeHtml(savedAnswer || "")}</textarea>`;
  }

  app.innerHTML = `
    <div class="timer-row">
      <span class="q-index mono">سؤال ${state.currentIndex + 1} / ${state.questions.length}</span>
      <span class="timer mono" id="timerText"></span>
    </div>
    <div class="progress-track"><div class="progress-fill" id="progressFill"></div></div>

    <div class="q-text">${escapeHtml(q.question_text)}</div>
    <div id="qBody">${bodyHtml}</div>

    <div id="qError"></div>
    <div style="margin-top:1.5rem; display:flex; justify-content:space-between;">
      <button class="secondary" id="prevBtn" ${state.currentIndex === 0 ? "disabled" : ""}>السؤال السابق</button>
      <button id="nextBtn">${isLast ? "تسليم الاختبار" : "السؤال التالي"}</button>
    </div>
  `;
  updateTimerUI();

  if (q.type === "mcq") {
    document.querySelectorAll(".option-row").forEach((row) => {
      row.addEventListener("click", () => {
        document.querySelectorAll(".option-row").forEach((r) => r.classList.remove("selected"));
        row.classList.add("selected");
        row.querySelector("input").checked = true;
      });
    });
  }

  document.getElementById("prevBtn").addEventListener("click", () => {
    saveCurrentAnswer();
    state.currentIndex--;
    renderQuestion();
  });

  document.getElementById("nextBtn").addEventListener("click", () => {
    const q = state.questions[state.currentIndex];
    const errBox = document.getElementById("qError");
    if (q.type === "essay" && !document.getElementById("essayAnswer").value.trim()) {
      errBox.innerHTML = `<div class="error-box">من فضلك اكتب إجابتك قبل المتابعة</div>`;
      return;
    }
    if (q.type === "mcq" && !document.querySelector('input[name="opt"]:checked')) {
      errBox.innerHTML = `<div class="error-box">من فضلك اختر إجابة</div>`;
      return;
    }
    saveCurrentAnswer();
    if (state.currentIndex === state.questions.length - 1) {
      submitQuiz();
    } else {
      state.currentIndex++;
      renderQuestion();
    }
  });
}

function saveCurrentAnswer() {
  const q = state.questions[state.currentIndex];
  if (q.type === "mcq") {
    const checked = document.querySelector('input[name="opt"]:checked');
    if (checked) state.answers[q.id] = checked.value;
  } else {
    state.answers[q.id] = document.getElementById("essayAnswer").value;
  }
}

// ---------------- التسليم وعرض النتيجة ----------------
async function submitQuiz() {
  clearInterval(state.timerHandle);
  tabDot.classList.remove("running");
  app.innerHTML = `<p class="mono" style="color:var(--text-muted)">... جاري التصحيح</p>`;

  const answersPayload = state.questions.map((q) => ({
    question_id: q.id,
    value: state.answers[q.id] ?? "",
  }));

  const durationSeconds = Math.round((Date.now() - state.startTime) / 1000);

  try {
    const result = await callFunction("submit-attempt", {
      body: { attempt_id: state.attemptId, answers: answersPayload, duration_seconds: durationSeconds },
    });
    renderResult(result);
  } catch (e) {
    app.innerHTML = `<div class="error-box">تعذر تسليم الاختبار: ${escapeHtml(e.message)}</div>`;
  }
}

function renderResult(result) {
  const pct = result.max_score > 0 ? Math.round((result.total_score / result.max_score) * 100) : 0;

  const reviewHtml = result.answers
    .map((a, i) => {
      const badgeClass = a.type === "mcq" ? (a.score >= a.max_score ? "ok" : "bad") : (a.score >= a.max_score ? "ok" : a.score > 0 ? "partial" : "bad");
      return `
      <div class="q-review">
        <div class="q-index mono">سؤال ${i + 1} <span class="badge ${badgeClass}">${a.score} / ${a.max_score}</span></div>
        <p style="color:var(--text); margin:.4rem 0;">${escapeHtml(a.feedback || "")}</p>
      </div>`;
    })
    .join("");

  app.innerHTML = `
    <div class="result-score">
      <div class="big mono">${result.total_score} / ${result.max_score}</div>
      <p>نسبة النجاح: ${pct}%</p>
    </div>
    ${reviewHtml}
    <div style="margin-top:1.5rem; text-align:center;">
      <a class="btn" href="index.html">العودة للرئيسية</a>
    </div>
  `;
}

renderStartScreen();
