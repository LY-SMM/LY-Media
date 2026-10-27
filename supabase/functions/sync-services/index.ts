import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

/* ——— تصنيف المنصة (احتياطي مطابق لقواعد قاعدة البيانات) ——— */
const BUILTIN_RULES = [
  ["instagram", "instagram", 10], ["instagram", "insta", 20], ["instagram", "انستقرام", 10],
  ["instagram", "انستغرام", 10], ["instagram", "ريلز", 40], ["instagram", "reels", 40],
  ["instagram", "ستوري", 50], ["instagram", "stories", 50],
  ["tiktok", "tiktok", 10], ["tiktok", "tik tok", 10], ["tiktok", "تيك توك", 10], ["tiktok", "تيكتوك", 10],
  ["youtube", "youtube", 10], ["youtube", "you tube", 20], ["youtube", "يوتيوب", 10],
  ["youtube", "ساعات مشاهدة", 40], ["youtube", "watch time", 40],
  ["facebook", "facebook", 10], ["facebook", "فيسبوك", 10], ["facebook", "فيس بوك", 20],
  ["twitter", "twitter", 10], ["twitter", "تويتر", 10], ["twitter", "x.com", 20],
  ["telegram", "telegram", 10], ["telegram", "تيليجرام", 10], ["telegram", "تليجرام", 10],
  ["whatsapp", "whatsapp", 10], ["whatsapp", "واتساب", 10],
  ["snapchat", "snapchat", 10], ["snapchat", "سناب", 10],
  ["spotify", "spotify", 10], ["spotify", "سبوتيفاي", 10],
  ["discord", "discord", 10], ["discord", "ديسكورد", 10],
  ["linkedin", "linkedin", 10], ["linkedin", "لينكدإن", 10],
  ["pinterest", "pinterest", 10], ["pinterest", "بنترست", 10],
];

function normalize(value) {
  let s = String(value == null ? "" : value).toLowerCase().trim();
  try {
    s = s.normalize("NFKD").replace(/[\u064B-\u065F\u0670]/g, "");
  } catch (_) { /* تجاهل */ }
  return s
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[ؤئ]/g, "ء")
    .replace(/[\u200E\u200F\u061C]/g, "")
    .replace(/\s+/g, " ");
}

function detect(text, rules) {
  const hay = normalize(text);
  if (!hay) return null;
  let best = null;
  let bestPriority = null;
  let ambiguous = false;
  const sorted = rules.slice().sort(
    (a, b) => (a.priority || 100) - (b.priority || 100)
  );
  for (const r of sorted) {
    const kw = normalize(r.keyword);
    if (!kw || hay.indexOf(kw) === -1) continue;
    const pr = r.priority == null ? 100 : Number(r.priority);
    if (best === null || pr < bestPriority) {
      best = r.platform;
      bestPriority = pr;
      ambiguous = false;
    } else if (pr === bestPriority && best !== r.platform) {
      ambiguous = true;
    }
  }
  return ambiguous ? null : best;
}

function classifyService(name, description, category, rules) {
  const byCategory = detect(category, rules);
  const byName = detect(String(name || "") + " " + String(description || ""), rules);
  if (byCategory && byName) return byCategory === byName ? byCategory : "other";
  return byCategory || byName || "other";
}

async function loadRules(admin) {
  try {
    const { data, error } = await admin
      .from("service_classification_rules")
      .select("platform, keyword, priority")
      .eq("is_active", true);
    if (error || !data || !data.length) {
      return BUILTIN_RULES.map((r) => ({ platform: r[0], keyword: r[1], priority: r[2] }));
    }
    return data.map((r) => ({
      platform: String(r.platform || "").toLowerCase(),
      keyword: String(r.keyword || ""),
      priority: r.priority == null ? 100 : Number(r.priority),
    }));
  } catch (_) {
    return BUILTIN_RULES.map((r) => ({ platform: r[0], keyword: r[1], priority: r[2] }));
  }
}

async function fetchProviderServices(apiUrl, apiKey) {
  const base = String(apiUrl || "").replace(/\/+$/, "");
  const endpoint = /\/api\/v2$/.test(base) ? base : base + "/api/v2";
  const body = new URLSearchParams();
  body.append("key", apiKey);
  body.append("action", "services");
  const res = await fetch(endpoint, { method: "POST", body });
  if (!res.ok) throw new Error("provider_http_" + res.status);
  const data = await res.json().catch(() => null);
  if (!Array.isArray(data)) throw new Error("provider_bad_response");
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return json({ ok: false, error: "server_not_configured" }, 500);

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ ok: false, error: "unauthorized" }, 401);

  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData || !userData.user) return json({ ok: false, error: "unauthorized" }, 401);

  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: prof } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (!prof || prof.role !== "admin") return json({ ok: false, error: "forbidden" }, 403);

  let providerId = null;
  try {
    const b = await req.json();
    if (b && b.provider_id != null) providerId = Number(b.provider_id);
  } catch (_) {}

  let provQuery = admin.from("providers").select("id, name, api_url, api_key, is_active");
  if (providerId && Number.isFinite(providerId)) provQuery = provQuery.eq("id", providerId);
  else provQuery = provQuery.eq("is_active", true);
  const { data: providers, error: provErr } = await provQuery;
  if (provErr) return json({ ok: false, error: "providers_query_failed" }, 500);
  if (!providers || !providers.length) return json({ ok: false, error: "no_providers" }, 400);

  const rules = await loadRules(admin);
  let platformSupported = true;

  const results = [];
  for (const p of providers) {
    if (!p.api_url || !p.api_key) {
      results.push({ provider_id: p.id, name: p.name, ok: false, error: "missing_api_config" });
      continue;
    }
    let list;
    try {
      list = await fetchProviderServices(p.api_url, p.api_key);
    } catch (e) {
      results.push({ provider_id: p.id, name: p.name, ok: false, error: String(e.message || e) });
      continue;
    }

    const rows = list
      .filter((s) => s && s.service != null && s.name != null)
      .map((s) => {
        const rate = Number(s.rate);
        return {
          name: String(s.name).slice(0, 500),
          category: s.category ? String(s.category) : "services",
          description: s.type ? String(s.type) : null,
          provider_id: p.id,
          provider_service_id: String(s.service),
          rate: Number.isFinite(rate) ? rate : 0,
          cost: Number.isFinite(rate) ? rate : 0,
          min_qty: Number.isFinite(Number(s.min)) && Number(s.min) > 0 ? Number(s.min) : 1,
          max_qty: Number.isFinite(Number(s.max)) ? Number(s.max) : null,
        };
      });

    if (!rows.length) {
      results.push({ provider_id: p.id, name: p.name, ok: true, fetched: 0, inserted: 0, updated: 0 });
      continue;
    }

    const existing = new Map();
    const pageSize = 1000;
    const existingFields = platformSupported
      ? "provider_service_id, is_active, markup, sort_order, platform, platform_source"
      : "provider_service_id, is_active, markup, sort_order";
    for (let offset = 0; ; offset += pageSize) {
      let { data: found, error: foundErr } = await admin
        .from("services")
        .select(existingFields)
        .eq("provider_id", p.id)
        .not("provider_service_id", "is", null)
        .range(offset, offset + pageSize - 1);

      if (foundErr && platformSupported) {
        // قاعدة البيانات لم يُطبَّق عليها الـ migration بعد.
        platformSupported = false;
        const retry = await admin
          .from("services")
          .select("provider_service_id, is_active, markup, sort_order")
          .eq("provider_id", p.id)
          .not("provider_service_id", "is", null)
          .range(offset, offset + pageSize - 1);
        found = retry.data;
        foundErr = retry.error;
      }
      if (foundErr) break;
      if (!found || !found.length) break;
      found.forEach((f) => existing.set(f.provider_service_id, f));
      if (found.length < pageSize) break;
    }

    let inserted = 0;
    let updated = 0;
    for (const r of rows) {
      if (existing.has(r.provider_service_id)) updated++;
      else inserted++;
    }

    const upsertRows = rows.map((r) => {
      const prev = existing.get(r.provider_service_id);
      const keepManual = Boolean(prev && prev.platform_source === "manual" && prev.platform);
      const base = {
        ...r,
        is_active: prev ? prev.is_active : false,
        markup: prev && prev.markup != null ? prev.markup : 0,
        sort_order: prev && prev.sort_order != null ? prev.sort_order : 0,
      };
      if (!platformSupported) return base;
      return {
        ...base,
        platform: keepManual
          ? prev.platform
          : classifyService(r.name, r.description, r.category, rules),
        platform_source: keepManual ? "manual" : "auto",
      };
    });

    const upsertChunk = 500;
    for (let i = 0; i < upsertRows.length; i += upsertChunk) {
      let chunk = upsertRows.slice(i, i + upsertChunk);
      let { error } = await admin
        .from("services")
        .upsert(chunk, { onConflict: "provider_id,provider_service_id" });

      if (error && /platform/i.test(String(error.message || ""))) {
        platformSupported = false;
        chunk = chunk.map((row) => {
          const copy = { ...row };
          delete copy.platform;
          delete copy.platform_source;
          return copy;
        });
        const retry = await admin
          .from("services")
          .upsert(chunk, { onConflict: "provider_id,provider_service_id" });
        error = retry.error;
      }

      if (error) {
        results.push({ provider_id: p.id, name: p.name, ok: false, error: "upsert_failed: " + error.message });
        inserted = -1;
        updated = -1;
        break;
      }
    }

    results.push({
      provider_id: p.id,
      name: p.name,
      ok: inserted >= 0,
      fetched: rows.length,
      inserted: Math.max(inserted, 0),
      updated: Math.max(updated, 0),
    });
  }

  const ok = results.every((r) => r.ok);
  return json({ ok, results });
});
