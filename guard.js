/* =========================
   digiy-pro-driver — GUARD CONSOLIDÉ (FINAL PROPRE) ✅ GITHUB PAGES SAFE
   - Session 8h
   - ✅ DRIVER: verify_access_pin(p_phone,p_pin,p_module) PRIORITY
     -> module = "driver_pro"
     -> slug envoyé dans p_phone (compat ta fonction 3 args)
   - Fallback: verify_access_pin(p_slug,p_pin) si besoin

   ✅ + Token maison (8h) pour actions PRO (heartbeat/accept) sans Supabase Auth
     - issue_driver_token(p_slug,p_pin,p_module,p_ttl_minutes)
     - stocké en localStorage: DIGIY_DRIVER_PRO_TOKEN
========================= */
(function () {
  "use strict";

  // =============================
  // CONFIG
  // =============================
  const SUPABASE_URL = "https://wesqmwjjtsefyjnluosj.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indlc3Ftd2pqdHNlZnlqbmx1b3NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNzg4ODIsImV4cCI6MjA4MDc1NDg4Mn0.dZfYOc2iL2_wRYL3zExZFsFSBK6AbMeOid2LrIjcTdA";

  // ✅ IMPORTANT: module ID exact (table digiy_pro_access)
  const DIGIY_MODULE = "driver_pro";

  const SESSION_KEY = "DIGIY_DRIVER_PRO_SESSION"; // ✅ driver unifié
  const SESSION_KEYS_COMPAT = [
    "DIGIY_DRIVER_PRO_SESSION_V1",
    "DIGIY_DRIVER_PRO_SESSION_V2",
    "DIGIY_DRIVER_PRO_SESSION_V1_8H",
  ];
  const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8h

  // ✅ Token maison (8h)
  const TOKEN_KEY = "DIGIY_DRIVER_PRO_TOKEN";
  const TOKEN_TTL_MINUTES = 480;

  const LS = {
    SLUG: "DIGIY_DRIVER_SLUG",
    PRO_ID: "DIGIY_DRIVER_PRO_ID",
    TITLE: "DIGIY_DRIVER_TITLE",
    PHONE: "DIGIY_DRIVER_PHONE",
  };

  function now() {
    return Date.now();
  }

  // =============================
  // SAFE localStorage
  // =============================
  function lsGet(k) {
    try {
      return localStorage.getItem(k);
    } catch (_) {
      return null;
    }
  }
  function lsSet(k, v) {
    try {
      localStorage.setItem(k, String(v ?? ""));
    } catch (_) {}
  }
  function lsDel(k) {
    try {
      localStorage.removeItem(k);
    } catch (_) {}
  }

  // =============================
  // SLUG HELPERS (SOURCE OF TRUTH)
  // =============================
  function urlSlugRaw() {
    try {
      return (new URLSearchParams(location.search).get("slug") || "").trim();
    } catch (_) {
      return "";
    }
  }

  function cleanSlug(s) {
    const x = String(s || "").trim();
    if (!x) return "";
    return x
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\-_]/g, "")
      .replace(/-+/g, "-")
      .replace(/^[-_]+|[-_]+$/g, "");
  }

  // =============================
  // SESSION (compat + unifié)
  // =============================
  function parseSession(raw) {
    try {
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || !s.expires_at) return null;
      if (now() > s.expires_at) return null;
      return s;
    } catch (_) {
      return null;
    }
  }

  function getSessionUnsafe() {
    const primary = parseSession(lsGet(SESSION_KEY));
    if (primary) return primary;

    for (const k of SESSION_KEYS_COMPAT) {
      const s = parseSession(lsGet(k));
      if (s) {
        try {
          lsSet(SESSION_KEY, JSON.stringify(s));
        } catch (_) {}
        return s;
      }
    }
    return null;
  }

  function getSession() {
    return getSessionUnsafe();
  }

  function setSession(data) {
    const session = {
      ...data,
      created_at: now(),
      expires_at: now() + SESSION_TTL_MS,
    };
    lsSet(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  function clearSession() {
    lsDel(SESSION_KEY);
    for (const k of SESSION_KEYS_COMPAT) lsDel(k);
  }

  // =============================
  // TOKEN (maison)
  // =============================
  function setDriverToken(token) {
    const t = String(token || "").trim();
    if (!t) return;
    lsSet(TOKEN_KEY, t);
  }
  function getDriverToken() {
    return String(lsGet(TOKEN_KEY) || "").trim();
  }
  function clearDriverToken() {
    lsDel(TOKEN_KEY);
  }

  function getSlug() {
    const u = cleanSlug(urlSlugRaw());
    if (u) return u;

    const s = getSessionUnsafe();
    const ss = cleanSlug(s?.slug || "");
    if (ss) return ss;

    return cleanSlug(lsGet(LS.SLUG) || "");
  }

  function syncSlugFromUrl() {
    const u = cleanSlug(urlSlugRaw());
    if (!u) return null;
    const cur = cleanSlug(lsGet(LS.SLUG) || "");
    if (cur !== u) lsSet(LS.SLUG, u);
    return u;
  }

  syncSlugFromUrl();

  // =============================
  // GITHUB PAGES SAFE BASE PATH ✅
  // =============================
  function basePath() {
    const parts = location.pathname.split("/").filter(Boolean);
    const isGithubPages = /\.github\.io$/i.test(location.hostname);
    if (isGithubPages && parts.length > 0) return "/" + parts[0] + "/";
    return "/";
  }

  function withSlug(url) {
    const s = getSlug();
    let clean = String(url || "").trim();

    if (/^https?:\/\//i.test(clean)) return clean;
    if (clean.startsWith("#")) return clean;

    clean = clean.replace(/^\/+/, "");
    if (!clean) clean = "index.html";

    if (s) clean += (clean.includes("?") ? "&" : "?") + "slug=" + encodeURIComponent(s);

    return basePath() + clean;
  }

  function go(url, mode = "assign") {
    const dest = withSlug(url);
    if (mode === "replace") location.replace(dest);
    else location.assign(dest);
  }

  // =============================
  // READY LOCK (safe)
  // =============================
  const READY = (function () {
    let _resolve, _reject;
    const promise = new Promise((res, rej) => {
      _resolve = res;
      _reject = rej;
    });
    return { promise, resolve: _resolve, reject: _reject, done: false };
  })();

  function markReady() {
    if (READY.done) return;
    READY.done = true;
    READY.resolve(true);
  }

  async function ready(timeoutMs = 8000) {
    if (READY.done) return true;

    let t;
    const timeout = new Promise((_, rej) => {
      t = setTimeout(() => rej(new Error("GUARD_READY_TIMEOUT")), timeoutMs);
    });

    try {
      await Promise.race([READY.promise, timeout]);
      return true;
    } finally {
      clearTimeout(t);
    }
  }

  // =============================
  // SUPABASE (SAFE / LAZY)
  // =============================
  async function waitSupabaseCDN(timeoutMs = 8000) {
    const start = now();
    while (now() - start < timeoutMs) {
      if (window.supabase?.createClient) return true;
      await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error("SUPABASE_CDN_NOT_READY");
  }

  async function getSbAsync() {
    await waitSupabaseCDN(8000);
    if (!window.__digiy_sb__) {
      window.__digiy_sb__ = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return window.__digiy_sb__;
  }

  function getSb() {
    if (!window.supabase?.createClient) return null;
    if (!window.__digiy_sb__) {
      window.__digiy_sb__ = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return window.__digiy_sb__;
  }

  // Helper RPC (simple)
  async function rpc(fn, args) {
    const sb = await getSbAsync();
    return sb.rpc(fn, args || {});
  }

  // =============================
  // ✅ RPC DRIVER: verify_access_pin
  // =============================
  async function rpcVerifyAccessPin(sb, slug, pin) {
    const s = cleanSlug(slug);
    const p = String(pin || "").trim();

    // ✅ PRIORITY: signature 3 args (p_phone,p_pin,p_module)
    // Chez toi: on met le slug dans p_phone.
    let res = await sb.rpc("verify_access_pin", {
      p_phone: s,
      p_pin: p,
      p_module: DIGIY_MODULE,
    });

    if (!res?.error) return res;

    // ✅ fallback: signature 2 args (p_slug,p_pin)
    const msg = String(res.error.message || "");
    const canTry2 =
      /not exist|function|parameter|argument|expects|unknown|p_phone|p_module/i.test(msg);

    if (canTry2) {
      res = await sb.rpc("verify_access_pin", { p_slug: s, p_pin: p });
      return res;
    }

    return res;
  }

  // =============================
  // ✅ Token maison: issue_driver_token (après PIN ok)
  // =============================
  async function issueToken(sb, slug, pin) {
    const s = cleanSlug(slug);
    const p = String(pin || "").trim();
    if (!s || !p) return { ok: false, error: "slug/pin requis" };

    const res = await sb.rpc("issue_driver_token", {
      p_slug: s,
      p_pin: p,
      p_module: DIGIY_MODULE,
      p_ttl_minutes: TOKEN_TTL_MINUTES,
    });

    if (res?.error) return { ok: false, error: res.error.message || String(res.error) };
    if (!res?.data?.ok || !res.data.token) return { ok: false, error: res?.data?.error || "token refusé" };

    setDriverToken(res.data.token);
    return { ok: true, token: res.data.token };
  }

  // =============================
  // LOGIN (slug + pin)
  // =============================
  async function loginWithPin(slug, pin) {
    const s = cleanSlug(slug || getSlug());
    const p = String(pin || "").trim();

    if (!s || !p) return { ok: false, error: "Slug et PIN requis" };

    let sb = null;
    try {
      sb = await getSbAsync();
    } catch (e) {
      return { ok: false, error: "Supabase non initialisé (CDN)" };
    }
    if (!sb) return { ok: false, error: "Supabase non initialisé" };

    const { data, error } = await rpcVerifyAccessPin(sb, s, p);
    if (error) return { ok: false, error: error.message || String(error) };

    const result =
      typeof data === "string"
        ? (function () {
            try {
              return JSON.parse(data);
            } catch (_) {
              return null;
            }
          })()
        : data;

    const ownerId = String(result?.owner_id || "").trim();

    if (!result?.ok || !ownerId) {
      return { ok: false, error: result?.error || "PIN invalide" };
    }

    const session = setSession({
      ok: true,
      owner_id: ownerId,
      slug: cleanSlug(result.slug || s),
      title: result.title || "",
      phone: result.phone || "",
      module: DIGIY_MODULE,
    });

    lsSet(LS.PRO_ID, session.owner_id);
    lsSet(LS.SLUG, session.slug);
    if (session.title) lsSet(LS.TITLE, session.title);
    if (session.phone) lsSet(LS.PHONE, session.phone);

    // ✅ Token maison (best effort) — ne bloque pas le login si ça échoue
    try {
      await issueToken(sb, session.slug, p);
    } catch (_) {}

    markReady();
    return { ok: true, session };
  }

  // =============================
  // REQUIRE SESSION
  // =============================
  function requireSession(redirect = "pin.html") {
    syncSlugFromUrl();

    const s = getSessionUnsafe();
    if (!s || !String(s.owner_id || "").trim()) {
      go(redirect, "replace");
      return null;
    }
    return s;
  }

  // =============================
  // BOOT (pages privées)
  // =============================
  async function boot(options) {
    const loginUrl = options?.login || "pin.html";

    const s = requireSession(loginUrl);
    if (!s) return { ok: false };

    try {
      await getSbAsync();
      markReady();
      return { ok: true, session: s };
    } catch (e) {
      console.warn("[GUARD] Supabase not ready:", e);
      go(loginUrl, "replace");
      return { ok: false, error: "SUPABASE_NOT_READY" };
    }
  }

  // =============================
  // LOGOUT
  // =============================
  function logout(redirect = "index.html") {
    clearSession();
    clearDriverToken();
    go(redirect, "replace");
  }

  // =============================
  // EXPORT
  // =============================
  window.DIGIY_GUARD = {
    boot,
    loginWithPin,
    requireSession,
    logout,
    getSession,
    getSb,
    getSbAsync,
    rpc, // ✅ helper RPC
    setDriverToken,
    getDriverToken,
    clearDriverToken,
    ready,
    getSlug,
    withSlug,
    go,
    syncSlugFromUrl,
    basePath,
  };
})();
