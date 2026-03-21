/* guard.js — DIGIY DRIVER
   Compat cockpit.html + pin.html
   - slug principal : ?slug=driver-221...
   - ready fonctionne en Promise ET en fonction thenable
   - expose : state, ready, refresh, rpc, rememberIdentity, rememberPinAccess, logout
   - zéro GPS / zéro realtime
*/
(() => {
  "use strict";

  const SUPABASE_URL = String(
    window.DIGIY_SUPABASE_URL || "https://wesqmwjjtsefyjnluosj.supabase.co"
  ).trim();

  const SUPABASE_ANON_KEY = String(
    window.DIGIY_SUPABASE_ANON ||
    window.DIGIY_SUPABASE_ANON_KEY ||
    "sb_publishable_tGHItRgeWDmGjnd0CK1DVQ_BIep4Ug3"
  ).trim();

  const MODULE_CODE = "DRIVER";
  const MODULE_PREFIX = "driver";
  const LOGIN_URL = window.DIGIY_LOGIN_URL || "./pin.html";
  const PAY_URL = "https://commencer-a-payer.digiylyfe.com/";

  const STORAGE = {
    session: `DIGIY_${MODULE_CODE}_SESSION`,
    access: `DIGIY_${MODULE_CODE}_ACCESS`,
    pin: `DIGIY_${MODULE_CODE}_PIN_ACCESS`,
    slug: `digiy_${MODULE_PREFIX}_slug`,
    lastSlug: `digiy_${MODULE_PREFIX}_last_slug`,
    phone: `digiy_${MODULE_PREFIX}_phone`
  };

  const state = {
    ok: false,
    preview: false,
    access_ok: false,
    pin_session_ok: false,
    slug: "",
    phone: "",
    module: MODULE_CODE,
    reason: "booting",
    pay_url: PAY_URL,
    pin_expires_at: ""
  };

  let bootPromise = null;
  let bootDone = false;

  function normPhone(v) {
    const d = String(v || "").replace(/[^\d]/g, "");
    if (!d) return "";
    if (d.startsWith("221") && d.length === 12) return d;
    if (d.length === 9) return "221" + d;
    return d.length >= 9 ? d : "";
  }

  function normSlug(v) {
    return String(v || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function isDriverSlug(v) {
    return /^driver-\d{12}$/.test(normSlug(v));
  }

  function phoneFromDriverSlug(v) {
    const s = normSlug(v);
    if (!isDriverSlug(s)) return "";
    return normPhone(s.slice("driver-".length));
  }

  function slugFromPhone(v) {
    const p = normPhone(v);
    return p ? `${MODULE_PREFIX}-${p}` : "";
  }

  function nowMs() {
    return Date.now();
  }

  function isoAfterHours(hours) {
    return new Date(nowMs() + Math.max(1, Number(hours || 6)) * 3600 * 1000).toISOString();
  }

  function parseJson(raw, fallback = null) {
    try {
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function getLocalJson(key) {
    try {
      return parseJson(localStorage.getItem(key), null);
    } catch (_) {
      return null;
    }
  }

  function setLocalJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  }

  function removeLocal(key) {
    try {
      localStorage.removeItem(key);
    } catch (_) {}
  }

  function getSessionJson(key) {
    try {
      return parseJson(sessionStorage.getItem(key), null);
    } catch (_) {
      return null;
    }
  }

  function setSessionJson(key, value) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  }

  function removeSession(key) {
    try {
      sessionStorage.removeItem(key);
    } catch (_) {}
  }

  function setState(patch) {
    Object.assign(state, patch || {});
    window.DIGIY_GUARD.state = state;
    return state;
  }

  function jsonHeaders() {
    return {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    };
  }

  function getHeaders() {
    return {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Accept: "application/json"
    };
  }

  async function rpc(name, body = {}) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify(body || {})
      });

      const data = await res.json().catch(() => null);

      return {
        ok: !!res.ok,
        status: res.status,
        data,
        error: res.ok ? null : (data || { message: "rpc_failed" })
      };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        data: null,
        error
      };
    }
  }

  async function tableGet(table, paramsObj = {}) {
    try {
      const params = new URLSearchParams(paramsObj);
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params.toString()}`, {
        method: "GET",
        headers: getHeaders()
      });

      const data = await res.json().catch(() => null);

      return {
        ok: !!res.ok,
        status: res.status,
        data,
        error: res.ok ? null : (data || { message: "table_get_failed" })
      };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        data: null,
        error
      };
    }
  }

  function getQs() {
    return new URLSearchParams(window.location.search);
  }

  function updateUrlSlugOnly(slug) {
    const s = normSlug(slug);
    if (!s) return;

    try {
      const u = new URL(window.location.href);
      if (normSlug(u.searchParams.get("slug") || "") === s) return;
      u.searchParams.set("slug", s);
      history.replaceState(null, "", u.toString());
    } catch (_) {}
  }

  function buildPayUrl({ slug, phone } = {}) {
    try {
      const u = new URL(PAY_URL);
      const s = normSlug(slug);
      const p = normPhone(phone);

      u.searchParams.set("module", MODULE_CODE);
      if (s) u.searchParams.set("slug", s);
      if (p) u.searchParams.set("phone", p);
      u.searchParams.set("return", window.location.href);

      return u.toString();
    } catch (_) {
      return PAY_URL;
    }
  }

  function rememberIdentity({ slug, phone } = {}) {
    const cleanPhone = normPhone(phone || phoneFromDriverSlug(slug));
    const cleanSlug = normSlug(slug || slugFromPhone(cleanPhone));

    const payload = {
      module: MODULE_CODE,
      slug: cleanSlug,
      phone: cleanPhone,
      at: new Date().toISOString()
    };

    try {
      if (cleanSlug) {
        sessionStorage.setItem(STORAGE.slug, cleanSlug);
        sessionStorage.setItem(STORAGE.lastSlug, cleanSlug);
        localStorage.setItem(STORAGE.lastSlug, cleanSlug);
      }

      if (cleanPhone) {
        sessionStorage.setItem(STORAGE.phone, cleanPhone);
        localStorage.setItem(STORAGE.phone, cleanPhone);
      }

      setLocalJson(STORAGE.session, payload);
      setLocalJson(STORAGE.access, payload);
      setSessionJson(STORAGE.session, payload);

      window.DIGIY_ACCESS = Object.assign({}, window.DIGIY_ACCESS || {}, payload);
      updateUrlSlugOnly(cleanSlug);
    } catch (_) {}

    return payload;
  }

  function clearIdentity() {
    removeSession(STORAGE.slug);
    removeSession(STORAGE.lastSlug);
    removeSession(STORAGE.phone);
    removeSession(STORAGE.session);

    removeLocal(STORAGE.lastSlug);
    removeLocal(STORAGE.phone);
    removeLocal(STORAGE.session);
    removeLocal(STORAGE.access);

    try {
      delete window.DIGIY_ACCESS;
    } catch (_) {}
  }

  function rememberPinAccess({ slug, phone, ttlHours = 6 } = {}) {
    const cleanPhone = normPhone(phone || phoneFromDriverSlug(slug));
    const cleanSlug = normSlug(slug || slugFromPhone(cleanPhone));

    const payload = {
      module: MODULE_CODE,
      slug: cleanSlug,
      phone: cleanPhone,
      created_at: new Date().toISOString(),
      expires_at: isoAfterHours(ttlHours)
    };

    setLocalJson(STORAGE.pin, payload);
    setSessionJson(STORAGE.pin, payload);
    rememberIdentity({ slug: cleanSlug, phone: cleanPhone });

    return payload;
  }

  function clearPinAccess() {
    removeLocal(STORAGE.pin);
    removeSession(STORAGE.pin);
  }

  function readPinAccess(currentSlug = "", currentPhone = "") {
    const raw =
      getSessionJson(STORAGE.pin) ||
      getLocalJson(STORAGE.pin) ||
      null;

    if (!raw || String(raw.module || "").toUpperCase() !== MODULE_CODE) {
      return null;
    }

    const expiresAt = Date.parse(raw.expires_at || "");
    if (!expiresAt || expiresAt <= nowMs()) {
      clearPinAccess();
      return null;
    }

    const storedSlug = normSlug(raw.slug);
    const storedPhone = normPhone(raw.phone);
    const expectedSlug = normSlug(currentSlug);
    const expectedPhone = normPhone(currentPhone);

    if (expectedSlug && storedSlug && expectedSlug !== storedSlug) {
      if (!(expectedPhone && storedPhone && expectedPhone === storedPhone)) {
        return null;
      }
    }

    if (expectedPhone && storedPhone && expectedPhone !== storedPhone) {
      if (!(expectedSlug && storedSlug && expectedSlug === storedSlug)) {
        return null;
      }
    }

    return {
      module: MODULE_CODE,
      slug: storedSlug,
      phone: storedPhone,
      expires_at: raw.expires_at
    };
  }

  function getRememberedIdentity() {
    const qs = getQs();

    const fromUrlSlug = normSlug(qs.get("slug") || "");
    const fromUrlPhone = normPhone(qs.get("phone") || "");

    const fromSessionStore = getSessionJson(STORAGE.session) || {};
    const fromLocalStore = getLocalJson(STORAGE.session) || {};
    const fromAccessStore = getLocalJson(STORAGE.access) || {};

    const storedSlug = normSlug(
      fromUrlSlug ||
      sessionStorage.getItem(STORAGE.slug) ||
      sessionStorage.getItem(STORAGE.lastSlug) ||
      localStorage.getItem(STORAGE.lastSlug) ||
      fromSessionStore.slug ||
      fromLocalStore.slug ||
      fromAccessStore.slug ||
      window.DIGIY_ACCESS?.slug ||
      ""
    );

    const storedPhone = normPhone(
      fromUrlPhone ||
      sessionStorage.getItem(STORAGE.phone) ||
      localStorage.getItem(STORAGE.phone) ||
      fromSessionStore.phone ||
      fromLocalStore.phone ||
      fromAccessStore.phone ||
      window.DIGIY_ACCESS?.phone ||
      ""
    );

    let slug = storedSlug;
    let phone = storedPhone;

    if (!phone && slug) {
      phone = phoneFromDriverSlug(slug);
    }

    if (!slug && phone) {
      slug = slugFromPhone(phone);
    }

    return {
      slug: normSlug(slug),
      phone: normPhone(phone)
    };
  }

  async function resolveSubBySlug(slug) {
    const s = normSlug(slug);
    if (!s) return null;

    const res = await tableGet("digiy_subscriptions_public", {
      select: "phone,slug,module",
      slug: `eq.${s}`,
      module: `eq.${MODULE_CODE}`,
      limit: "1"
    });

    if (!res.ok || !Array.isArray(res.data) || !res.data[0]) return null;

    return {
      slug: normSlug(res.data[0].slug),
      phone: normPhone(res.data[0].phone),
      module: String(res.data[0].module || "")
    };
  }

  async function resolveSubByPhone(phone) {
    const p = normPhone(phone);
    if (!p) return null;

    const res = await tableGet("digiy_subscriptions_public", {
      select: "phone,slug,module",
      phone: `eq.${p}`,
      module: `eq.${MODULE_CODE}`,
      limit: "1"
    });

    if (!res.ok || !Array.isArray(res.data) || !res.data[0]) return null;

    return {
      slug: normSlug(res.data[0].slug),
      phone: normPhone(res.data[0].phone),
      module: String(res.data[0].module || "")
    };
  }

  function resultLooksTrue(data) {
    if (data === true) return true;
    if (!data) return false;

    if (Array.isArray(data)) {
      return data.length ? resultLooksTrue(data[0]) : false;
    }

    if (typeof data === "object") {
      if (data.ok === true) return true;
      if (data.valid === true) return true;
      if (data.success === true) return true;
      if (data.access === true) return true;
      if (data.allowed === true) return true;
      if (data.is_valid === true) return true;
      if (String(data.status || "").toLowerCase() === "ok") return true;
    }

    return false;
  }

  async function checkAccess(phone) {
    const p = normPhone(phone);
    if (!p) return false;

    const tries = [
      { p_phone: p, p_module: MODULE_CODE },
      { p_phone: p, p_module: MODULE_CODE.toLowerCase() },
      { phone: p, module: MODULE_CODE }
    ];

    for (const args of tries) {
      const res = await rpc("digiy_has_access", args);
      if (res.ok && resultLooksTrue(res.data)) {
        return true;
      }
    }

    return false;
  }

  async function computeState() {
    let { slug, phone } = getRememberedIdentity();

    if (slug && !phone) {
      phone = phoneFromDriverSlug(slug);
    }

    if (!slug && phone) {
      slug = slugFromPhone(phone);
    }

    if (slug && !phone) {
      const bySlug = await resolveSubBySlug(slug);
      if (bySlug?.phone) phone = normPhone(bySlug.phone);
      if (bySlug?.slug) slug = normSlug(bySlug.slug);
    }

    if (phone && !slug) {
      const byPhone = await resolveSubByPhone(phone);
      if (byPhone?.slug) slug = normSlug(byPhone.slug);
    }

    if (!phone && slug) {
      phone = phoneFromDriverSlug(slug);
    }

    if (!slug && phone) {
      slug = slugFromPhone(phone);
    }

    if (slug || phone) {
      rememberIdentity({ slug, phone });
    }

    const pinAccess = readPinAccess(slug, phone);
    const pinSessionOk = !!pinAccess;

    const accessFromPin = pinSessionOk;
    const accessFromSub = phone ? await checkAccess(phone) : false;
    const accessOk = !!(accessFromPin || accessFromSub);

    let reason = "idle";
    if (!slug) reason = "slug_missing";
    else if (!phone) reason = "phone_missing";
    else if (pinSessionOk) reason = "pin_session_ok";
    else if (accessFromSub) reason = "subscription_ok";
    else reason = "access_required";

    const next = {
      ok: true,
      preview: false,
      access_ok: accessOk,
      pin_session_ok: pinSessionOk,
      slug: normSlug(slug),
      phone: normPhone(phone),
      module: MODULE_CODE,
      reason,
      pay_url: buildPayUrl({ slug, phone }),
      pin_expires_at: pinAccess?.expires_at || ""
    };

    if (next.slug) {
      updateUrlSlugOnly(next.slug);
    }

    return setState(next);
  }

  async function refresh() {
    try {
      const next = await computeState();
      bootDone = true;
      return next;
    } catch (error) {
      console.error("DIGIY_GUARD refresh error:", error);

      return setState({
        ok: false,
        preview: false,
        access_ok: false,
        pin_session_ok: false,
        slug: "",
        phone: "",
        module: MODULE_CODE,
        reason: "guard_error",
        pay_url: buildPayUrl({}),
        pin_expires_at: ""
      });
    }
  }

  function logout() {
    clearPinAccess();
    clearIdentity();

    const next = setState({
      ok: true,
      preview: false,
      access_ok: false,
      pin_session_ok: false,
      slug: "",
      phone: "",
      module: MODULE_CODE,
      reason: "logged_out",
      pay_url: buildPayUrl({}),
      pin_expires_at: ""
    });

    return next;
  }

  function buildLoginUrl(slug) {
    const s = normSlug(slug);
    const u = new URL(LOGIN_URL, window.location.href);
    if (s) u.searchParams.set("slug", s);
    return u.toString();
  }

  function goLogin(slug) {
    try {
      window.location.replace(buildLoginUrl(slug));
    } catch (_) {
      window.location.href = buildLoginUrl(slug);
    }
  }

  function showPage() {
    try {
      document.documentElement.style.visibility = "";
    } catch (_) {}
  }

  function installWatchdog() {
    window.setTimeout(() => {
      showPage();
    }, 1200);

    window.addEventListener("pageshow", showPage);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) showPage();
    });
  }

  function makeReadyThenable(promiseFactory) {
    function readyFn() {
      return promiseFactory();
    }

    readyFn.then = (...args) => promiseFactory().then(...args);
    readyFn.catch = (...args) => promiseFactory().catch(...args);
    readyFn.finally = (...args) => promiseFactory().finally(...args);

    return readyFn;
  }

  function readyPromise() {
    if (!bootPromise) {
      bootPromise = refresh().finally(() => {
        showPage();
      });
    }
    return bootPromise;
  }

  const api = {
    state,
    module: MODULE_CODE,
    normPhone,
    normSlug,
    isDriverSlug,
    phoneFromDriverSlug,
    slugFromPhone,
    rpc,
    refresh,
    logout,
    rememberIdentity,
    rememberPinAccess,
    clearPinAccess,
    getSession: getRememberedIdentity,
    buildPayUrl,
    buildLoginUrl,
    goLogin
  };

  api.ready = makeReadyThenable(readyPromise);

  window.DIGIY_GUARD = api;

  installWatchdog();
  readyPromise();
})();
