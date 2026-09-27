let lastAttempts = [];

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
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "x-dashboard-password": pw,
      },
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
    .map((a) => {
      const pct = a.max_score > 0 ? Math.round((a.total_score / a.max_score) * 100) : 0;
      const date = new Date(a.submitted_at).toLocaleString("ar-EG");
      return `<tr>
        <td>${escapeHtml(a.student_name)}</td>
        <td>${a.grade}</td>
        <td>${escapeHtml(a.lessons?.title || "")}</td>
        <td class="mono">${a.total_score} / ${a.max_score} (${pct}%)</td>
        <td class="mono">${date}</td>
      </tr>`;
    })
    .join("");

  resultsBox.innerHTML = `
    <div style="overflow-x:auto; margin-top:1.2rem;">
      <table class="results-table">
        <thead><tr><th>الاسم</th><th>الصف</th><th>الدرس</th><th>الدرجة</th><th>تاريخ التسليم</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function exportCsv() {
  const header = ["الاسم", "الصف", "الدرس", "الدرجة", "الدرجة الكلية", "النسبة", "تاريخ التسليم"];
  const lines = [header.join(",")];
  lastAttempts.forEach((a) => {
    const pct = a.max_score > 0 ? Math.round((a.total_score / a.max_score) * 100) : 0;
    const date = new Date(a.submitted_at).toLocaleString("ar-EG");
    lines.push(
      [a.student_name, a.grade, a.lessons?.title || "", a.total_score, a.max_score, `${pct}%`, date]
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
