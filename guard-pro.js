// guard-pro.js — DIGIY PRO access gate (slug-first) -> ABOS (ANTI-BOUCLE)
(() => {
  "use strict";

  const SUPABASE_URL = "https://wesqmwjjtsefyjnluosj.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indlc3Ftd2pqdHNlZnlqbmx1b3NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNzg4ODIsImV4cCI6MjA4MDc1NDg4Mn0.dZfYOc2iL2_wRYL3zExZFsFSBK6AbMeOid2LrIjcTdA";

  const MODULE_CODE = "DRIVER";
  const PAY_URL = "https://commencer-a-payer.digiylyfe.com/";
  const PRO_ENTRY_URL = "https://pro-driver.digiylyfe.com/";

  const qs = new URLSearchParams(location.search);
  const slugQ  = (qs.get("slug")  || "").trim();
  const phoneQ = (qs.get("phone") || "").trim();

  function normPhone(p) {
    const d = String(p || "").replace(/[^\d]/g, "");
    return d.length >= 9 ? d : "";
  }

  function normSlug(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  // ✅ Patch important : si slug = driver-22177..., on peut déduire le phone direct
  function phoneFromDriverSlug(slug) {
    const s = String(slug || "").trim().toLowerCase();
    if (!s.startsWith("driver-")) return "";
    const digits = s.replace(/^driver-/, "").replace(/[^\d]/g, "");
    return digits.length >= 9 ? digits : "";
  }

  async function rpc(name, params) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params || {}),
    });

    const j = await r.json().catch(() => null);
    return { ok: r.ok, status: r.status, data: j };
  }

  async function resolvePhoneFromSlug(slug) {
    const s = normSlug(slug);
    if (!s) return "";

    // 1) priorité: déduction driver-xxxx
    const direct = phoneFromDriverSlug(s);
    if (direct) return direct;

    // 2) fallback: subscriptions_public si dispo
    const url =
      `${SUPABASE_URL}/rest/v1/digiy_subscriptions_public` +
      `?select=phone,slug,module&slug=eq.${encodeURIComponent(s)}&limit=1`;

    const r = await fetch(url, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });

    const arr = await r.json().catch(() => []);
    if (!r.ok || !Array.isArray(arr) || !arr[0]?.phone) return "";
    return String(arr[0].phone);
  }

  function buildReturnUrl({ phone, slug }) {
    const p = normPhone(phone);
    const s = normSlug(slug);
    const back = new URL(PRO_ENTRY_URL);
    if (s) back.searchParams.set("slug", s);
    else if (p) back.searchParams.set("slug", `driver-${p}`);
    return back.toString();
  }

  function goPay({ phone, slug }) {
    try { if (location.href.startsWith(PAY_URL)) return; } catch (_) {}

    const p = normPhone(phone);
    const s = normSlug(slug);

    const u = new URL(PAY_URL);
    u.searchParams.set("module", MODULE_CODE);
    if (p) u.searchParams.set("phone", p);
    if (s) u.searchParams.set("slug", s);
    u.searchParams.set("return", buildReturnUrl({ phone: p, slug: s }));

    location.replace(u.toString());
  }

  async function main() {
    const slug = normSlug(slugQ);
    let phone = normPhone(phoneQ);

    if (!phone && slug) phone = normPhone(await resolvePhoneFromSlug(slug));
    if (!phone) {
      goPay({ phone: "", slug });
      return;
    }

    const res = await rpc("digiy_has_access", { p_phone: phone, p_module: MODULE_CODE });

    if (res.ok && res.data === true) return;

    if (res.ok && res.data === false) {
      goPay({ phone, slug });
      return;
    }

    console.warn("[guard-pro] digiy_has_access unexpected:", res);
  }

  main().catch((e) => {
    console.warn("[guard-pro] crash:", e);
  });
})();
