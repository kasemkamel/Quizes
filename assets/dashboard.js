let lastAttempts = [];
const GRADE_NAMES = { 1: "أولى ثانوي", 2: "تانية ثانوي", 3: "بايثون" };

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

document.getElementById("loadBtn").addEventListener("click", loadResults);
document.getElementById("exportBtn").addEventListener("click", exportCsv);

async function loadResults() {
  const pw = document.getElementById("pw").value;
  const errBox = document.getElementById("dashError");
  const resultsBox = document.getElementById("results");
  errBox.innerHTML = "";
  resultsBox.innerHTML = `<p class="mono" style="color:var(--text-muted)">... جاري التحميل</p>`;

  try {
    const res = await fetch(`${FUNCTIONS_URL}/get-results`, {
      headers: authHeaders({ "x-dashboard-password": encodeURIComponent(pw) }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "حدث خطأ");

    lastAttempts = data.attempts;
    renderTable(lastAttempts);
    document.getElementById("exportBtn").style.display = lastAttempts.length ? "inline-block" : "none";
  } catch (e) {
    resultsBox.innerHTML = "";
    errBox.innerHTML = `<div class="error-box">${escapeHtml(e.message)}</div>`;
  }
}

function renderTable(attempts) {
  const resultsBox = document.getElementById("results");
  if (attempts.length === 0) {
    resultsBox.innerHTML = `<p>لا توجد نتائج مُسلَّمة بعد.</p>`;
    return;
  }

  const rows = attempts
    .map((a, idx) => {
      const pct = a.max_score > 0 ? Math.round((a.total_score / a.max_score) * 100) : 0;
      const date = new Date(a.submitted_at).toLocaleString("ar-EG");
      const details = (a.answers || [])
        .map((x, i) => `
          <div class="q-review">
            <div class="q-index mono">سؤال ${i + 1} (${x.type === "mcq" ? "اختياري" : "مقالي"})
              <span class="badge ${x.score >= x.max_score ? "ok" : x.score > 0 ? "partial" : "bad"}">${x.score} / ${x.max_score}</span>
              ${x.graded_by ? `<span class="badge partial">${escapeHtml(x.graded_by)}</span>` : ""}
            </div>
            <p style="color:var(--text); margin:.3rem 0;">${escapeHtml(x.question_text || "")}</p>
            <p style="margin:.3rem 0;"><b>إجابة الطالب:</b> ${escapeHtml(x.student_answer || "(فارغة)")}</p>
            <p style="margin:.3rem 0;"><b>التقييم:</b> ${escapeHtml(x.feedback || "")}</p>
            ${x.ai_errors && x.ai_errors.length ? `<p class="mono" style="direction:ltr;color:var(--danger-text);font-size:.78rem;">${x.ai_errors.map(escapeHtml).join("<br>")}</p>` : ""}
          </div>`)
        .join("");
      return `<tr>
        <td>${escapeHtml(a.student_name)}</td>
        <td>${GRADE_NAMES[a.grade] || a.grade}</td>
        <td>${escapeHtml(a.lessons?.title || "")}</td>
        <td class="mono">${a.total_score} / ${a.max_score} (${pct}%)</td>
        <td class="mono">${date}</td>
        <td><button class="secondary" style="padding:.3rem .8rem;font-size:.85rem;" onclick="toggleDetails(${idx})">الإجابات</button></td>
      </tr>
      <tr id="det-${idx}" style="display:none;"><td colspan="6">${details}</td></tr>`;
    })
    .join("");

  resultsBox.innerHTML = `
    <div style="overflow-x:auto; margin-top:1.2rem;">
      <table class="results-table">
        <thead><tr><th>الاسم</th><th>الصف</th><th>الدرس</th><th>الدرجة</th><th>تاريخ التسليم</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function toggleDetails(i) {
  const r = document.getElementById("det-" + i);
  r.style.display = r.style.display === "none" ? "table-row" : "none";
}

function exportCsv() {
  const header = ["الاسم", "الصف", "الدرس", "الدرجة", "الدرجة الكلية", "النسبة", "تاريخ التسليم"];
  const lines = [header.join(",")];
  lastAttempts.forEach((a) => {
    const pct = a.max_score > 0 ? Math.round((a.total_score / a.max_score) * 100) : 0;
    const date = new Date(a.submitted_at).toLocaleString("ar-EG");
    lines.push(
      [a.student_name, GRADE_NAMES[a.grade] || a.grade, a.lessons?.title || "", a.total_score, a.max_score, `${pct}%`, date]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
  });
  const csv = "\uFEFF" + lines.join("\n"); // BOM عشان اكسل يقرا العربي صح
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `نتائج_الطلبة_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
