// guard.js — DIGIY DRIVER PRO access gate (preview-safe, slug-first, cockpit-compatible)
(() => {
  "use strict";

  const SUPABASE_URL =
    window.DIGIY_SUPABASE_URL ||
    "https://wesqmwjjtsefyjnluosj.supabase.co";

  const SUPABASE_ANON_KEY =
    window.DIGIY_SUPABASE_ANON ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indlc3Ftd2pqdHNlZnlqbmx1b3NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNzg4ODIsImV4cCI6MjA4MDc1NDg4Mn0.dZfYOc2iL2_wRYL3zExZFsFSBK6AbMeOid2LrIjcTdA";

  const MODULE_CODE = "DRIVER";
  const PAY_URL = "https://commencer-a-payer.digiylyfe.com/";

  // true  => sans identité, on laisse voir le logiciel
  // false => sans identité, on considère que la page doit être paywallée
  const ALLOW_PREVIEW_WITHOUT_IDENTITY = true;

  const qs = new URLSearchParams(location.search);
  const slugQ = (qs.get("slug") || "").trim();
  const phoneQ = (qs.get("phone") || "").trim();

  function normPhone(v) {
    const d = String(v || "").replace(/[^\d]/g, "");
    return d.length >= 9 ? d : "";
  }

  function normSlug(v) {
    return String(v || "").trim().toLowerCase();
  }

  function phoneFromDriverSlug(slug) {
    const s = normSlug(slug);
    if (!s.startsWith("driver-")) return "";
    const digits = s.slice("driver-".length).replace(/[^\d]/g, "");
    return digits.length >= 9 ? digits : "";
  }

  function buildHeaders(withJson = false) {
    const headers = {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`
    };
    if (withJson) headers["Content-Type"] = "application/json";
    return headers;
  }

  async function rpc(name, params) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: buildHeaders(true),
      body: JSON.stringify(params || {})
    });

    const text = await r.text().catch(() => "");
    let data = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
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
      headers: buildHeaders(false)
    });

    if (!r.ok) return null;

    const rows = await r.json().catch(() => []);
    if (!Array.isArray(rows) || !rows.length) return null;

    return {
      phone: normPhone(rows[0].phone || ""),
      slug: normSlug(rows[0].slug || ""),
      module: String(rows[0].module || "").toUpperCase().trim()
    };
  }

  async function fetchPublicByPhone(phone) {
    const p = normPhone(phone);
    if (!p) return null;

    const url =
      `${SUPABASE_URL}/rest/v1/digiy_subscriptions_public` +
      `?select=phone,module,slug` +
      `&module=eq.${encodeURIComponent(MODULE_CODE)}` +
      `&phone=eq.${encodeURIComponent(p)}` +
      `&limit=1`;

    const r = await fetch(url, {
      method: "GET",
      headers: buildHeaders(false)
    });

    if (!r.ok) return null;

    const rows = await r.json().catch(() => []);
    if (!Array.isArray(rows) || !rows.length) return null;

    return {
      phone: normPhone(rows[0].phone || ""),
      slug: normSlug(rows[0].slug || ""),
      module: String(rows[0].module || "").toUpperCase().trim()
    };
  }

  function extractHasAccess(data) {
    if (data === true) return true;
    if (data === false) return false;
    if (!data) return false;

    if (typeof data === "object" && !Array.isArray(data)) {
      if (data.has_access === true) return true;
      if (data.active === true) return true;
      if (String(data.status || "").toLowerCase() === "active") return true;
    }

    if (Array.isArray(data) && data.length) {
      return extractHasAccess(data[0]);
    }

    return false;
  }

  function buildPayUrl({ phone, slug }) {
    const p = normPhone(phone);
    const s = normSlug(slug);

    const u = new URL(PAY_URL);
    u.searchParams.set("module", MODULE_CODE);

    if (p) u.searchParams.set("phone", p);
    if (s) u.searchParams.set("slug", s);

    // retour vers la page courante
    u.searchParams.set("return", location.href);

    return u.toString();
  }

  function rememberIdentity({ slug, phone }) {
    const s = normSlug(slug);
    const p = normPhone(phone);

    if (s) {
      sessionStorage.setItem("digiy_driver_slug", s);
      sessionStorage.setItem("digiy_driver_last_slug", s);
      localStorage.setItem("digiy_driver_last_slug", s);
    }

    if (p) {
      sessionStorage.setItem("digiy_driver_phone", p);
      localStorage.setItem("digiy_driver_phone", p);
      localStorage.setItem("digiy_last_phone", p);
    }
  }

  function enrichUrlIfMissingSlug(slug) {
    const s = normSlug(slug);
    if (!s) return;

    const u = new URL(location.href);
    const currentSlug = normSlug(u.searchParams.get("slug") || "");
    if (currentSlug === s) return;

    u.searchParams.set("slug", s);
    history.replaceState(null, "", u.toString());
  }

  async function computeState() {
    let slug = normSlug(slugQ);
    let phone = normPhone(phoneQ);

    const state = {
      ok: true,
      preview: false,
      has_identity: false,
      slug: "",
      phone: "",
      module: MODULE_CODE,
      access_ok: false,
      should_pay: false,
      pay_url: buildPayUrl({ phone, slug }),
      reason: null,
      error: null
    };

    // 1) Rien => aperçu
    if (!slug && !phone) {
      state.preview = !!ALLOW_PREVIEW_WITHOUT_IDENTITY;
      state.reason = ALLOW_PREVIEW_WITHOUT_IDENTITY ? "preview_no_identity" : "missing_identity";
      state.ok = ALLOW_PREVIEW_WITHOUT_IDENTITY;
      return state;
    }

    // 2) slug-first
    if (slug && !phone) {
      const row = await fetchPublicBySlug(slug);
      if (row?.phone) {
        phone = normPhone(row.phone);
        slug = normSlug(row.slug || slug);
      }
    }

    // 3) fallback driver-221...
    if (!phone && slug) {
      phone = phoneFromDriverSlug(slug);
    }

    // 4) phone-only => retrouver le slug public
    if (phone && !slug) {
      const row = await fetchPublicByPhone(phone);
      if (row?.slug) {
        slug = normSlug(row.slug);
      } else {
        slug = `driver-${phone}`;
      }
    }

    state.slug = slug || "";
    state.phone = phone || "";
    state.has_identity = !!(slug || phone);
    state.pay_url = buildPayUrl({ phone, slug });

    if (slug || phone) {
      rememberIdentity({ slug, phone });
      if (slug) enrichUrlIfMissingSlug(slug);
    }

    // 5) pas de téléphone résolu
    if (!phone) {
      if (ALLOW_PREVIEW_WITHOUT_IDENTITY) {
        state.preview = true;
        state.reason = "preview_no_phone";
        return state;
      }

      state.ok = false;
      state.should_pay = true;
      state.reason = "no_phone";
      return state;
    }

    // 6) vérité backend
    const res = await rpc("digiy_has_access", {
      p_phone: phone,
      p_module: MODULE_CODE
    });

    const has = !!(res.ok && extractHasAccess(res.data));
    state.access_ok = has;

    if (has) {
      state.reason = "access_ok";
      return state;
    }

    state.ok = false;
    state.reason = "no_subscription";
    state.should_pay = true;
    return state;
  }

  async function refresh() {
    try {
      const state = await computeState();
      window.DIGIY_GUARD.state = state;
      return state;
    } catch (e) {
      const fallback = {
        ok: false,
        preview: !!ALLOW_PREVIEW_WITHOUT_IDENTITY,
        has_identity: false,
        slug: normSlug(slugQ),
        phone: normPhone(phoneQ),
        module: MODULE_CODE,
        access_ok: false,
        should_pay: false,
        pay_url: buildPayUrl({ phone: phoneQ, slug: slugQ }),
        reason: "guard_error",
        error: String(e?.message || e)
      };

      window.DIGIY_GUARD.state = fallback;
      return fallback;
    }
  }

  async function requirePaidAccess() {
    const st = await refresh();

    if (st.preview) return st;
    if (st.access_ok) return st;

    if (st.should_pay && st.pay_url) {
      location.replace(st.pay_url);
      return st;
    }

    return st;
  }

  async function checkAccess() {
    const st = await refresh();
    return !!st.access_ok;
  }

  window.DIGIY_GUARD = {
    module: MODULE_CODE,
    session: { slug: "", phone: "" },
    state: null,
    ready: null,
    rpc,
    refresh,
    requirePaidAccess,
    checkAccess
  };

  window.DIGIY_GUARD.ready = refresh().then((st) => {
    window.DIGIY_GUARD.session.slug = st.slug || "";
    window.DIGIY_GUARD.session.phone = st.phone || "";
    return st;
  });
})();
