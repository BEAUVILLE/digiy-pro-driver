// guard.js — DIGIY DRIVER PRO access gate (slug-first, NO public view)
(() => {
  "use strict";

  const SUPABASE_URL = "https://wesqmwjjtsefyjnluosj.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indlc3Ftd2pqdHNlZnlqbmx1b3NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNzg4ODIsImV4cCI6MjA4MDc1NDg4Mn0.dZfYOc2iL2_wRYL3zExZFsFSBK6AbMeOid2LrIjcTdA";

  const MODULE_CODE = "DRIVER";
  const PAY_URL = "https://commencer-a-payer.digiylyfe.com/";
  const DEFAULT_RETURN = (() => {
    try { return location.origin + "/dashboard-pro.html?slug="; }
    catch(_) { return "https://pro-driver.digiylyfe.com/dashboard-pro.html?slug="; }
  })();

  const qs = new URLSearchParams(location.search);
  const slugQ  = (qs.get("slug")  || "").trim();
  const phoneQ = (qs.get("phone") || "").trim();

  function normPhone(p) {
    const d = String(p || "").replace(/[^\d]/g, "");
    return d.length >= 9 ? d : "";
  }
  function normSlug(s) {
    return String(s || "").trim().toLowerCase();
  }

  // ✅ DRIVER slug pattern → phone direct
  function phoneFromDriverSlug(slug) {
    const s = normSlug(slug);
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

    const text = await r.text().catch(() => "");
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = text || null; }
    return { ok: r.ok, status: r.status, data };
  }

  function extractHasAccess(data) {
    if (data === true) return true;
    if (data === false) return false;
    if (!data) return false;
    if (typeof data === "object" && !Array.isArray(data)) {
      if (data.has_access === true) return true;
      if (data.active === true) return true;
      if (data.status && String(data.status).toLowerCase() === "active") return true;
    }
    if (Array.isArray(data) && data.length) return extractHasAccess(data[0]);
    return false;
  }

  function goPay({ phone, slug }) {
    // anti-boucle
    try { if (location.href.startsWith(PAY_URL)) return; } catch (_) {}

    const p = normPhone(phone);
    const s = normSlug(slug);

    const u = new URL(PAY_URL);
    u.searchParams.set("module", MODULE_CODE);
    if (p) u.searchParams.set("phone", p);
    if (s) u.searchParams.set("slug", s);

    const backSlug = s || (p ? `driver-${p}` : "");
    u.searchParams.set("return", DEFAULT_RETURN + encodeURIComponent(backSlug));

    location.replace(u.toString());
  }

  // ✅ API globale
  const GUARD = {
    module: MODULE_CODE,
    session: { slug: "", phone: "" },
    rpc: (name, params) => rpc(name, params),
    ready: null,
    checkAccess: async () => {
      const p = normPhone(GUARD.session.phone);
      if (!p) return false;
      const res = await rpc("digiy_has_access", { p_phone: p, p_module: MODULE_CODE });
      return !!(res.ok && extractHasAccess(res.data));
    }
  };
  window.DIGIY_GUARD = GUARD;

  GUARD.ready = (async () => {
    const slug = normSlug(slugQ);
    let phone = normPhone(phoneQ);

    // slug-first (sans view publique)
    if (!phone && slug) phone = phoneFromDriverSlug(slug);

    GUARD.session.slug = slug || (phone ? `driver-${phone}` : "");
    GUARD.session.phone = phone || "";

    // si pas de phone : on ne sait pas qui c'est → pay
    if (!phone) {
      goPay({ phone: "", slug: GUARD.session.slug });
      return { ok: false, reason: "no_phone", ...GUARD.session };
    }

    // check access
    const res = await rpc("digiy_has_access", { p_phone: phone, p_module: MODULE_CODE });
    const has = res.ok && extractHasAccess(res.data);

    if (has) return { ok: true, reason: "access_ok", ...GUARD.session };

    goPay({ phone, slug: GUARD.session.slug });
    return { ok: false, reason: "no_access", ...GUARD.session };
  })().catch((e) => {
    console.warn("[guard] crash:", e);
    return { ok: false, reason: "crash", slug: normSlug(slugQ), phone: normPhone(phoneQ) };
  });
})();
