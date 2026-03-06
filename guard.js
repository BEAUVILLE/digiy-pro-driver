// guard.js — DIGIY DRIVER PRO access gate (slug-first, via public view + fallback)
(() => {
  "use strict";

  const SUPABASE_URL = "https://wesqmwjjtsefyjnluosj.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indlc3Ftd2pqdHNlZnlqbmx1b3NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNzg4ODIsImV4cCI6MjA4MDc1NDg4Mn0.dZfYOc2iL2_wRYL3zExZFsFSBK6AbMeOid2LrIjcTdA";

  const MODULE_CODE = "DRIVER";
  const PAY_URL = "https://commencer-a-payer.digiylyfe.com/";
  const DEFAULT_RETURN = (() => {
    try {
      return location.origin + "/dashboard-pro.html?slug=";
    } catch (_) {
      return "https://pro-driver.digiylyfe.com/dashboard-pro.html?slug=";
    }
  })();

  const qs = new URLSearchParams(location.search);
  const slugQ = (qs.get("slug") || "").trim();
  const phoneQ = (qs.get("phone") || "").trim();

  function normPhone(p) {
    const d = String(p || "").replace(/[^\d]/g, "");
    return d.length >= 9 ? d : "";
  }

  function normSlug(s) {
    return String(s || "").trim().toLowerCase();
  }

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
    try {
      data = text ? JSON.parse(text) : null;
    } catch (_) {
      data = text || null;
    }

    return { ok: r.ok, status: r.status, data };
  }

  async function fetchPublicBySlug(slug) {
    const s = normSlug(slug);
    if (!s) return null;

    const url =
      `${SUPABASE_URL}/rest/v1/digiy_subscriptions_public` +
      `?select=phone,module,slug` +
      `&module=eq.${encodeURIComponent(MODULE_CODE)}` +
      `&slug=eq.${encodeURIComponent(s)}` +
      `&limit=1`;

    const r = await fetch(url, {
      method: "GET",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    if (!r.ok) return null;

    const rows = await r.json().catch(() => []);
    if (!Array.isArray(rows) || !rows.length) return null;

    return rows[0] || null;
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

    if (Array.isArray(data) && data.length) {
      return extractHasAccess(data[0]);
    }

    return false;
  }

  function buildReturnSlug(slug, phone) {
    const s = normSlug(slug);
    const p = normPhone(phone);
    if (s) return s;
    if (p) return `driver-${p}`;
    return "";
  }

  function goPay({ phone, slug }) {
    try {
      if (location.href.startsWith(PAY_URL)) return;
    } catch (_) {}

    const p = normPhone(phone);
    const s = normSlug(slug);
    const backSlug = buildReturnSlug(s, p);

    const u = new URL(PAY_URL);
    u.searchParams.set("module", MODULE_CODE);
    if (p) u.searchParams.set("phone", p);
    if (s) u.searchParams.set("slug", s);
    if (backSlug) u.searchParams.set("return", DEFAULT_RETURN + backSlug);

    location.replace(u.toString());
  }

  const GUARD = {
    module: MODULE_CODE,
    session: { slug: "", phone: "" },
    rpc: (name, params) => rpc(name, params),
    ready: null,
    checkAccess: async () => {
      const p = normPhone(GUARD.session.phone);
      if (!p) return false;

      const res = await rpc("digiy_has_access", {
        p_phone: p,
        p_module: MODULE_CODE,
      });

      return !!(res.ok && extractHasAccess(res.data));
    },
  };

  window.DIGIY_GUARD = GUARD;

  GUARD.ready = (async () => {
    let slug = normSlug(slugQ);
    let phone = normPhone(phoneQ);

    // 1) Si slug fourni, on tente d'abord la vue publique
    if (slug && !phone) {
      const row = await fetchPublicBySlug(slug);
      if (row && row.phone) {
        phone = normPhone(row.phone);
        slug = normSlug(row.slug || slug);
      }
    }

    // 2) Fallback slug DRIVER téléphonique
    if (!phone && slug) {
      phone = phoneFromDriverSlug(slug);
    }

    // 3) Si phone fourni mais pas slug, on reconstruit un slug standard
    if (!slug && phone) {
      slug = `driver-${phone}`;
    }

    GUARD.session.slug = slug || "";
    GUARD.session.phone = phone || "";

    if (!phone) {
      goPay({ phone: "", slug });
      return { ok: false, reason: "no_phone", slug, phone: "" };
    }

    const res = await rpc("digiy_has_access", {
      p_phone: phone,
      p_module: MODULE_CODE,
    });

    const has = !!(res.ok && extractHasAccess(res.data));

    if (has) {
      return { ok: true, reason: "access_ok", slug, phone };
    }

    goPay({ phone, slug });
    return { ok: false, reason: "no_access", slug, phone };
  })().catch((e) => {
    console.warn("[DIGIY_GUARD][DRIVER] crash:", e);
    const slug = normSlug(slugQ);
    const phone = normPhone(phoneQ);
    return { ok: false, reason: "crash", slug, phone };
  });
})();
