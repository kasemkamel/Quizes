// ============================================================
// عدّل القيمتين دول بس بعد ما تعمل مشروع Supabase
// SUPABASE_URL: من Project Settings -> API -> Project URL
// SUPABASE_ANON_KEY: من نفس الصفحة -> anon public key (مش الـ service_role!)
// ============================================================
const SUPABASE_URL = "https://tfgxmjgjohlceyucayab.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmZ3htamdqb2hsY2V5dWNheWFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA1MzcwOTUsImV4cCI6MjEwNjExMzA5NX0.rK1MehntTk6zOVtbSn7QH8RXGbqj3keoCtgGTTzWZ4Y";

// مبنيين تلقائيًا - متلمسهمش
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

// هيدر موحد: المفتاح الجديد (sb_publishable_...) مش JWT فبنبعته في apikey بس،
// أما المفتاح القديم (eyJ...) فبنبعته كمان في Authorization
function authHeaders(extra = {}) {
  const h = { apikey: SUPABASE_ANON_KEY, ...extra };
  if (SUPABASE_ANON_KEY.startsWith("eyJ")) h.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  return h;
}
