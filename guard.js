/* guard.js — DIGIY DRIVER / DRIVER GUARD
   Rail attendu :
   - slug-only : ?slug=driver-221...
   - window.DIGIY_GUARD.ready()
   - window.DIGIY_GUARD.state
   - window.DIGIY_GUARD.loginWithPin(slug, pin)
*/
(() => {
  "use strict";

  const SUPABASE_URL = "https://wesqmwjjtsefyjnluosj.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_tGHItRgeWDmGjnd0CK1DVQ_BIep4Ug3";

  const MODULE_CODE = "DRIVER";
  const LOGIN_URL = window.DIGIY_LOGIN_URL || "./pin.html";
  const PAY_URL = "https://commencer-a-payer.digiylyfe.com/";

  const ALLOW_PREVIEW_WITHOUT_IDENTITY = false;

  const SESSION_KEY = `DIGIY_${MODULE_CODE}_SESSION`;
  const ACCESS_KEY = `DIGIY_${MODULE_CODE}_ACCESS`;
  const MODULE_PREFIX = "digiy_driver";
  
  const STORE = {
    sessionSlug: `digiy_${MODULE_KEY}_slug`,
    sessionPhone: `digiy_${MODULE_KEY}_phone`,
    sessionPinAccess: `digiy_${MODULE_KEY}_pin_access`,
    localLastSlug: `digiy_${MODULE_KEY}_last_slug`,
    localLastPhone: `digiy_${MODULE_KEY}_last_phone`,
    globalLastPhone: "digiy_last_phone"
  };

  function readQs() {
    return new URLSearchParams(location.search);
  }

  function normPhone(v) {
    const d = String(v || "").replace(/[^\d]/g, "");
    if (!d) return "";
    if (d.startsWith("221") && d.length === 12) return d;
    if (d.length === 9) return "221" + d;
    return d.length >= 9 ? d : "";
  }

  function normSlug(v) {
    return String(v || "").trim().toLowerCase();
  }

  function phoneFromDriverSlug(slug) {
    const s = normSlug(slug);
    if (!s.startsWith("driver-")) return "";
    return normPhone(s.slice("driver-".length));
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
      phone: normPhone(rows[0]?.phone || ""),
      slug: normSlug(rows[0]?.slug || ""),
      module: String(rows[0]?.module || "").toUpperCase().trim()
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
      phone: normPhone(rows[0]?.phone || ""),
      slug: normSlug(rows[0]?.slug || ""),
      module: String(rows[0]?.module || "").toUpperCase().trim()
    };
  }

  function extractHasAccess(data) {
    if (data === true) return true;
    if (data === false) return false;
    if (!data) return false;

    if (Array.isArray(data) && data.length) {
      return extractHasAccess(data[0]);
    }

    if (typeof data === "object") {
      if (data.has_access === true) return true;
      if (data.active === true) return true;
      if (String(data.status || "").toLowerCase() === "active") return true;
      if (data.ok === true && data.access === true) return true;
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

    u.searchParams.set("return", location.href);
    return u.toString();
  }

  function getUrlIdentity() {
    const qs = readQs();
    return {
      slug: normSlug(qs.get("slug") || ""),
      phone: normPhone(qs.get("phone") || "")
    };
  }

  function getStoredIdentity() {
    const sessionSlug = normSlug(sessionStorage.getItem(STORE.sessionSlug) || "");
    const sessionPhone = normPhone(sessionStorage.getItem(STORE.sessionPhone) || "");
    const localSlug = normSlug(localStorage.getItem(STORE.localLastSlug) || "");
    const localPhone =
      normPhone(localStorage.getItem(STORE.localLastPhone) || "") ||
      normPhone(localStorage.getItem(STORE.globalLastPhone) || "");

    return {
      slug: sessionSlug || localSlug || "",
      phone: sessionPhone || localPhone || ""
    };
  }

  function rememberIdentity({ slug, phone }) {
    const s = normSlug(slug);
    const p = normPhone(phone);

    if (s) {
      sessionStorage.setItem(STORE.sessionSlug, s);
      localStorage.setItem(STORE.localLastSlug, s);
    }

    if (p) {
      sessionStorage.setItem(STORE.sessionPhone, p);
      localStorage.setItem(STORE.localLastPhone, p);
      localStorage.setItem(STORE.globalLastPhone, p);
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

  function clearPinAccess() {
    sessionStorage.removeItem(STORE.sessionPinAccess);
  }

  function rememberPinAccess({ slug, phone, ttlHours } = {}) {
    const s = normSlug(slug);
    const p = normPhone(phone);
    const hours = Number(ttlHours || DEFAULT_PIN_SESSION_HOURS);
    const expiresAt = Date.now() + Math.max(1, hours) * 60 * 60 * 1000;

    const payload = {
      module: MODULE_CODE,
      slug: s,
      phone: p,
      granted_at: new Date().toISOString(),
      expires_at: new Date(expiresAt).toISOString()
    };

    sessionStorage.setItem(STORE.sessionPinAccess, JSON.stringify(payload));
    rememberIdentity({ slug: s, phone: p });
    return payload;
  }

  function getPinAccess() {
    const raw = sessionStorage.getItem(STORE.sessionPinAccess);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        clearPinAccess();
        return null;
      }

      if (String(parsed.module || "").toUpperCase().trim() !== MODULE_CODE) {
        clearPinAccess();
        return null;
      }

      const expiresAt = new Date(parsed.expires_at || "").getTime();
      if (!expiresAt || expiresAt <= Date.now()) {
        clearPinAccess();
        return null;
      }

      return {
        module: MODULE_CODE,
        slug: normSlug(parsed.slug || ""),
        phone: normPhone(parsed.phone || ""),
        granted_at: String(parsed.granted_at || ""),
        expires_at: String(parsed.expires_at || "")
      };
    } catch {
      clearPinAccess();
      return null;
    }
  }

  function pinSessionMatches(pinSession, { slug, phone }) {
    if (!pinSession) return false;

    const s = normSlug(slug);
    const p = normPhone(phone);

    if (s && pinSession.slug && pinSession.slug === s) return true;
    if (p && pinSession.phone && pinSession.phone === p) return true;

    return false;
  }

  async function computeState() {
    let { slug, phone } = getUrlIdentity();
    const stored = getStoredIdentity();
    const pinSession = getPinAccess();

    if (!slug && stored.slug) slug = stored.slug;
    if (!phone && stored.phone) phone = stored.phone;

    if (!slug && pinSession?.slug) slug = normSlug(pinSession.slug);
    if (!phone && pinSession?.phone) phone = normPhone(pinSession.phone);

    const state = {
      ok: true,
      preview: false,
      has_identity: false,
      slug: "",
      phone: "",
      module: MODULE_CODE,
      access_ok: false,
      pin_session_ok: false,
      should_pay: false,
      pay_url: buildPayUrl({ phone, slug }),
      reason: null,
      error: null
    };

    if (!slug && !phone) {
      state.preview = !!ALLOW_PREVIEW_WITHOUT_IDENTITY;
      state.reason = ALLOW_PREVIEW_WITHOUT_IDENTITY ? "preview_no_identity" : "missing_identity";
      state.ok = ALLOW_PREVIEW_WITHOUT_IDENTITY;
      return state;
    }

    if (slug && !phone) {
      const row = await fetchPublicBySlug(slug);
      if (row?.phone) {
        phone = normPhone(row.phone);
        slug = normSlug(row.slug || slug);
      }
    }

    if (!phone && slug) {
      phone = phoneFromDriverSlug(slug);
    }

    if (phone && !slug) {
      const row = await fetchPublicByPhone(phone);
      if (row?.slug) {
        slug = normSlug(row.slug);
      } else {
        slug = `driver-${phone}`;
      }
    }

    if (!phone && pinSession?.phone && pinSessionMatches(pinSession, { slug, phone })) {
      phone = normPhone(pinSession.phone);
    }

    if (!slug && pinSession?.slug) {
      slug = normSlug(pinSession.slug);
    }

    state.slug = slug || "";
    state.phone = phone || "";
    state.has_identity = !!(slug || phone);
    state.pay_url = buildPayUrl({ phone, slug });

    if (slug || phone) {
      rememberIdentity({ slug, phone });
      if (slug) enrichUrlIfMissingSlug(slug);
    }

    if (pinSession && pinSessionMatches(pinSession, { slug, phone })) {
      state.ok = true;
      state.preview = false;
      state.access_ok = true;
      state.pin_session_ok = true;
      state.reason = "pin_session_ok";
      return state;
    }

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
      window.DIGIY_GUARD.session.slug = state.slug || "";
      window.DIGIY_GUARD.session.phone = state.phone || "";
      return state;
    } catch (e) {
      const current = getUrlIdentity();
      const fallback = {
        ok: false,
        preview: !!ALLOW_PREVIEW_WITHOUT_IDENTITY,
        has_identity: false,
        slug: normSlug(current.slug),
        phone: normPhone(current.phone),
        module: MODULE_CODE,
        access_ok: false,
        pin_session_ok: false,
        should_pay: false,
        pay_url: buildPayUrl({ phone: current.phone, slug: current.slug }),
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
    checkAccess,
    rememberIdentity,
    rememberPinAccess,
    getPinAccess,
    clearPinAccess
  };

  window.DIGIY_GUARD.ready = refresh();
})();
