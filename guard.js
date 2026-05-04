// guard.js — DIGIY DRIVER PRO
// Doctrine : PIN une seule fois -> session locale fraîche -> navigation interne directe 8h
// Sécurité : pas de phone dans les URLs, pas de slug sensible exposé, serveur gardien
(() => {
  "use strict";

  const CFG = {
    SUPABASE_URL:
      window.DIGIY_SUPABASE_URL ||
      "https://wesqmwjjtsefyjnluosj.supabase.co",

    SUPABASE_ANON_KEY:
      window.DIGIY_SUPABASE_ANON ||
      window.DIGIY_SUPABASE_ANON_KEY ||
      "sb_publishable_tGHItRgeWDmGjnd0CK1DVQ_BIep4Ug3",

    MODULE_CODE: "DRIVER",
    MODULE_CODE_LOWER: "driver",

    SESSION_MAX_AGE_MS: 8 * 60 * 60 * 1000,

    PIN_PATH: window.DIGIY_LOGIN_URL || "./pin.html",
    PAY_URL: window.DIGIY_PAY_URL || "https://commencer-a-payer.digiylyfe.com/",

    ALLOW_PREVIEW_WITHOUT_IDENTITY: false,

    STORAGE: {
      SESSION_KEYS: [
        "DIGIY_DRIVER_PIN_SESSION",
        "DIGIY_PIN_SESSION",
        "DIGIY_ACCESS",
        "DIGIY_SESSION_DRIVER",
        "digiy_driver_session",
        "digiy_guard_driver_session",
        "digiy_guard_session"
      ],
      SLUG_KEY: "digiy_driver_slug",
      PHONE_KEY: "digiy_driver_phone",
      LAST_SLUG_KEY: "digiy_driver_last_slug",
      LAST_PHONE_KEY: "digiy_driver_last_phone",
      HUB_PHONE_KEY: "DIGIY_DRIVER_HUB_PHONE"
    },

    RPC: {
      VERIFY_PIN: "digiy_verify_pin",
      HAS_ACCESS: "digiy_has_access"
    },

    TABLES: {
      SUBSCRIPTIONS_PUBLIC: "digiy_subscriptions_public"
    }
  };

  const MODULE = CFG.MODULE_CODE;
  const MODULE_LOWER = CFG.MODULE_CODE_LOWER;

  let supabaseClient = null;
  let pendingPromise = null;

  function safeJsonParse(raw) {
    try {
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function normSlug(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-_]/g, "")
      .replace(/-+/g, "-")
      .replace(/^[-_]+|[-_]+$/g, "");
  }

  function normPhone(value) {
    const digits = String(value || "").replace(/[^\d]/g, "");
    if (!digits) return "";
    if (digits.startsWith("221") && digits.length === 12) return digits;
    if (digits.length === 9) return "221" + digits;
    return digits;
  }

  function normPin(value) {
    return String(value || "").trim().replace(/\s+/g, "");
  }

  function upper(value) {
    return String(value || "").trim().toUpperCase();
  }

  function nowMs() {
    return Date.now();
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function parseTime(value) {
    if (value === null || value === undefined || value === "") return 0;

    if (typeof value === "number" && Number.isFinite(value)) {
      return value < 100000000000 ? value * 1000 : value;
    }

    const s = String(value).trim();
    if (!s) return 0;

    if (/^\d+$/.test(s)) {
      const n = Number(s);
      if (!Number.isFinite(n)) return 0;
      return n < 100000000000 ? n * 1000 : n;
    }

    const d = Date.parse(s);
    return Number.isFinite(d) ? d : 0;
  }

  function isRecent(ts) {
    const n = parseTime(ts);
    if (!n) return false;
    return (nowMs() - n) <= CFG.SESSION_MAX_AGE_MS;
  }

  function isSensitiveSlug(slug) {
    return /\d{7,}/.test(String(slug || ""));
  }

  function canExposeSlug(slug) {
    const s = normSlug(slug);
    return !!s && !isSensitiveSlug(s);
  }

  function isLoginPage() {
    const path = String(location.pathname || "").toLowerCase();
    return path.endsWith("/pin.html") || path.endsWith("pin.html");
  }

  function isPublicEntryPage() {
    const path = String(location.pathname || "").toLowerCase();
    return path.endsWith("/") || path.endsWith("/index.html") || path.endsWith("index.html");
  }

  function hidePage() {
    try {
      document.documentElement.style.visibility = "hidden";
    } catch (_) {}
  }

  function showPage() {
    try {
      document.documentElement.style.visibility = "";
    } catch (_) {}
  }

  function getQuery() {
    try {
      return new URLSearchParams(location.search || "");
    } catch (_) {
      return new URLSearchParams();
    }
  }

  function readUrlContext() {
    const qs = getQuery();
    return {
      slug: normSlug(qs.get("slug") || qs.get("identifiant") || ""),
      phone: normPhone(qs.get("phone") || qs.get("tel") || "")
    };
  }

  function readSession(key) {
    try {
      return sessionStorage.getItem(key) || "";
    } catch (_) {
      return "";
    }
  }

  function readLocal(key) {
    try {
      return localStorage.getItem(key) || "";
    } catch (_) {
      return "";
    }
  }

  function readStorage(key) {
    return readSession(key) || readLocal(key) || "";
  }

  function writeSession(key, value) {
    try {
      sessionStorage.setItem(key, value);
    } catch (_) {}
  }

  function writeLocal(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (_) {}
  }

  function removeSession(key) {
    try {
      sessionStorage.removeItem(key);
    } catch (_) {}
  }

  function removeLocal(key) {
    try {
      localStorage.removeItem(key);
    } catch (_) {}
  }

  function removeBoth(key) {
    removeSession(key);
    removeLocal(key);
  }

  function jsonHeaders() {
    return {
      apikey: CFG.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${CFG.SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    };
  }

  function getHeaders() {
    return {
      apikey: CFG.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${CFG.SUPABASE_ANON_KEY}`,
      Accept: "application/json"
    };
  }

  function getSb() {
    if (supabaseClient) return supabaseClient;

    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      return null;
    }

    supabaseClient = window.supabase.createClient(
      CFG.SUPABASE_URL,
      CFG.SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
          storageKey: "digiy-driver-guard-auth"
        }
      }
    );

    window.sb = supabaseClient;
    return supabaseClient;
  }

  async function rpc(name, body) {
    const res = await fetch(`${CFG.SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify(body || {})
    });

    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  }

  async function tableGet(table, paramsObj) {
    const params = new URLSearchParams(paramsObj || {});
    const res = await fetch(`${CFG.SUPABASE_URL}/rest/v1/${table}?${params.toString()}`, {
      method: "GET",
      headers: getHeaders()
    });

    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  }

  function cleanVisibleUrl(contextSlug) {
    try {
      const url = new URL(location.href);
      let changed = false;

      if (url.searchParams.has("phone")) {
        url.searchParams.delete("phone");
        changed = true;
      }

      if (url.searchParams.has("tel")) {
        url.searchParams.delete("tel");
        changed = true;
      }

      const urlSlug = normSlug(url.searchParams.get("slug") || "");
      const urlIdentifiant = normSlug(url.searchParams.get("identifiant") || "");
      const finalSlug = normSlug(contextSlug || urlSlug || urlIdentifiant || "");

      if (urlSlug && isSensitiveSlug(urlSlug)) {
        url.searchParams.delete("slug");
        changed = true;
      }

      if (urlIdentifiant && isSensitiveSlug(urlIdentifiant)) {
        url.searchParams.delete("identifiant");
        changed = true;
      }

      if (finalSlug && isSensitiveSlug(finalSlug)) {
        if (url.searchParams.has("slug")) {
          url.searchParams.delete("slug");
          changed = true;
        }
        if (url.searchParams.has("identifiant")) {
          url.searchParams.delete("identifiant");
          changed = true;
        }
      }

      if (changed) {
        history.replaceState({}, "", url.pathname + url.search + url.hash);
      }
    } catch (_) {}
  }

  function sanitizeReturnUrl(value) {
    try {
      const url = new URL(value || location.href, location.href);

      if (url.origin !== location.origin) {
        return location.pathname;
      }

      url.searchParams.delete("phone");
      url.searchParams.delete("tel");

      const slug = normSlug(url.searchParams.get("slug") || "");
      const identifiant = normSlug(url.searchParams.get("identifiant") || "");

      if (slug && isSensitiveSlug(slug)) url.searchParams.delete("slug");
      if (identifiant && isSensitiveSlug(identifiant)) url.searchParams.delete("identifiant");

      return url.pathname + url.search + url.hash;
    } catch (_) {
      return location.pathname;
    }
  }

  function buildSafeUrl(path, params = {}) {
    const url = new URL(path || location.href, location.href);

    url.searchParams.delete("phone");
    url.searchParams.delete("tel");

    Object.entries(params || {}).forEach(([key, value]) => {
      const clean = String(value == null ? "" : value).trim();

      if (key === "phone" || key === "tel") return;

      if (key === "slug" || key === "identifiant") {
        const slug = normSlug(clean);
        if (canExposeSlug(slug)) url.searchParams.set("slug", slug);
        else {
          url.searchParams.delete("slug");
          url.searchParams.delete("identifiant");
        }
        return;
      }

      if (clean) url.searchParams.set(key, clean);
      else url.searchParams.delete(key);
    });

    const slug = normSlug(url.searchParams.get("slug") || "");
    if (slug && isSensitiveSlug(slug)) url.searchParams.delete("slug");

    if (url.origin === location.origin) {
      return url.pathname + url.search + url.hash;
    }

    return url.toString();
  }

  function saveSlugOnly(slug) {
    const clean = normSlug(slug);
    if (!clean) return;

    writeSession(CFG.STORAGE.SLUG_KEY, clean);
    writeSession(CFG.STORAGE.LAST_SLUG_KEY, clean);

    if (canExposeSlug(clean)) {
      writeLocal(CFG.STORAGE.SLUG_KEY, clean);
      writeLocal(CFG.STORAGE.LAST_SLUG_KEY, clean);
    } else {
      removeLocal(CFG.STORAGE.SLUG_KEY);
      removeLocal(CFG.STORAGE.LAST_SLUG_KEY);
    }
  }

  function savePhoneOnly(phone) {
    const clean = normPhone(phone);
    if (!clean) return;

    writeSession(CFG.STORAGE.PHONE_KEY, clean);
    writeSession(CFG.STORAGE.LAST_PHONE_KEY, clean);
    writeSession(CFG.STORAGE.HUB_PHONE_KEY, clean);

    removeLocal(CFG.STORAGE.PHONE_KEY);
    removeLocal(CFG.STORAGE.LAST_PHONE_KEY);
    removeLocal(CFG.STORAGE.HUB_PHONE_KEY);

    window.DIGIY_DRIVER_HUB_PHONE = clean;
  }

  function removeLegacySensitiveLocal() {
    [CFG.STORAGE.SLUG_KEY, CFG.STORAGE.LAST_SLUG_KEY].forEach((key) => {
      const value = normSlug(readLocal(key));
      if (value && isSensitiveSlug(value)) removeLocal(key);
    });

    [CFG.STORAGE.PHONE_KEY, CFG.STORAGE.LAST_PHONE_KEY, CFG.STORAGE.HUB_PHONE_KEY].forEach(removeLocal);
  }

  function rememberIdentity(payload = {}) {
    const slug = normSlug(payload.slug || "");
    const phone = normPhone(payload.phone || "");

    if (slug) saveSlugOnly(slug);
    if (phone) savePhoneOnly(phone);

    if (slug) state.slug = slug;
    if (phone) state.phone = phone;

    state.pin_url = buildPinUrl({ slug: state.slug, phone: state.phone });
    state.pay_url = buildPayUrl({ slug: state.slug, phone: state.phone });

    cleanVisibleUrl(state.slug);

    return {
      slug: state.slug,
      phone: state.phone
    };
  }

  function readSavedSlug() {
    const urlCtx = readUrlContext();

    const candidate =
      urlCtx.slug ||
      readSession(CFG.STORAGE.SLUG_KEY) ||
      readSession(CFG.STORAGE.LAST_SLUG_KEY) ||
      readLocal(CFG.STORAGE.SLUG_KEY) ||
      readLocal(CFG.STORAGE.LAST_SLUG_KEY) ||
      "";

    const clean = normSlug(candidate);

    if (clean && isSensitiveSlug(clean)) {
      removeLocal(CFG.STORAGE.SLUG_KEY);
      removeLocal(CFG.STORAGE.LAST_SLUG_KEY);
    }

    return clean;
  }

  function readSavedPhone() {
    const urlCtx = readUrlContext();

    return normPhone(
      urlCtx.phone ||
      readSession(CFG.STORAGE.PHONE_KEY) ||
      readSession(CFG.STORAGE.LAST_PHONE_KEY) ||
      readSession(CFG.STORAGE.HUB_PHONE_KEY) ||
      window.DIGIY_DRIVER_HUB_PHONE ||
      ""
    );
  }

  function clearSessionsOnly() {
    for (const key of CFG.STORAGE.SESSION_KEYS) {
      removeBoth(key);
    }
  }

  function clearAllLocalState() {
    clearSessionsOnly();

    [
      CFG.STORAGE.SLUG_KEY,
      CFG.STORAGE.PHONE_KEY,
      CFG.STORAGE.LAST_SLUG_KEY,
      CFG.STORAGE.LAST_PHONE_KEY,
      CFG.STORAGE.HUB_PHONE_KEY
    ].forEach(removeBoth);
  }

  function readStoredSession() {
    for (const key of CFG.STORAGE.SESSION_KEYS) {
      let parsed = null;

      parsed = safeJsonParse(readSession(key));
      if (!parsed) parsed = safeJsonParse(readLocal(key));

      if (!parsed || typeof parsed !== "object") continue;

      const moduleName = upper(parsed.module || parsed.module_code || "");
      const slug = normSlug(parsed.slug || "");
      const phone = normPhone(parsed.phone || "");
      const owner_id = parsed.owner_id || null;

      const access =
        !!parsed.access ||
        !!parsed.access_ok ||
        !!parsed.ok ||
        !!parsed.has_access ||
        !!parsed.pin_session_ok;

      const verifiedAt =
        parseTime(parsed.verified_at) ||
        parseTime(parsed.validated_at_ms) ||
        parseTime(parsed.ts) ||
        parseTime(parsed.created_at) ||
        0;

      const expiresAt = parseTime(parsed.expires_at || parsed.expiresAt || 0);
      const validatedAtIso = parsed.validated_at || null;

      const ageOk =
        (expiresAt && nowMs() < expiresAt) ||
        (verifiedAt && isRecent(verifiedAt)) ||
        (validatedAtIso && isRecent(validatedAtIso));

      if (!slug && !phone) continue;
      if (moduleName && moduleName !== MODULE) continue;
      if (!ageOk) continue;
      if (!access) continue;

      return {
        key,
        slug,
        phone,
        owner_id,
        module: MODULE,
        access: true,
        access_ok: true,
        pin_session_ok: true,
        verified_at: verifiedAt || nowMs(),
        expires_at: expiresAt || (nowMs() + CFG.SESSION_MAX_AGE_MS),
        validated_at: validatedAtIso || new Date(verifiedAt || nowMs()).toISOString()
      };
    }

    return null;
  }

  function saveSession(payload = {}) {
    const verifiedAtMs = parseTime(payload.verified_at || payload.validated_at_ms || 0) || nowMs();
    const expiresAtMs = parseTime(payload.expires_at || 0) || (verifiedAtMs + CFG.SESSION_MAX_AGE_MS);

    const validatedAtIso =
      payload.validated_at ||
      (verifiedAtMs ? new Date(verifiedAtMs).toISOString() : nowIso());

    const session = {
      slug: normSlug(payload.slug || state.slug || ""),
      phone: normPhone(payload.phone || state.phone || ""),
      owner_id: payload.owner_id || state.owner_id || null,
      module: MODULE,
      access: !!payload.access,
      access_ok: !!payload.access,
      pin_session_ok: !!payload.access,
      verified_at: verifiedAtMs,
      expires_at: expiresAtMs,
      validated_at: validatedAtIso,
      ts: nowMs()
    };

    const raw = JSON.stringify(session);

    for (const key of CFG.STORAGE.SESSION_KEYS) {
      writeSession(key, raw);
      writeLocal(key, raw);
    }

    if (session.slug) saveSlugOnly(session.slug);
    if (session.phone) savePhoneOnly(session.phone);

    try {
      window.DIGIY_ACCESS = Object.assign({}, window.DIGIY_ACCESS || {}, session);
    } catch (_) {}

    cleanVisibleUrl(session.slug);

    return session;
  }

  function buildPinUrl(input = {}) {
    const url = new URL(CFG.PIN_PATH, location.href);

    const slug = normSlug(input.slug || state.slug || "");

    url.searchParams.delete("phone");
    url.searchParams.delete("tel");

    if (canExposeSlug(slug)) {
      url.searchParams.set("slug", slug);
    } else {
      url.searchParams.delete("slug");
      url.searchParams.delete("identifiant");
    }

    url.searchParams.set("return", sanitizeReturnUrl(location.href));

    return url.toString();
  }

  function goPin(input = {}) {
    const slug = normSlug(input.slug || state.slug || "");
    const phone = normPhone(input.phone || state.phone || "");

    if (slug) saveSlugOnly(slug);
    if (phone) savePhoneOnly(phone);

    location.replace(buildPinUrl({ slug, phone }));
  }

  function buildPayUrl(input = {}) {
    const url = new URL(CFG.PAY_URL);

    const slug = normSlug(input.slug || state.slug || "");

    url.searchParams.set("module", MODULE);

    if (canExposeSlug(slug)) {
      url.searchParams.set("slug", slug);
    }

    url.searchParams.delete("phone");
    url.searchParams.delete("tel");
    url.searchParams.set("return", sanitizeReturnUrl(location.href));

    return url.toString();
  }

  function goPay(input = {}) {
    location.replace(buildPayUrl(input));
  }

  function ensureUrlIdentity(slug) {
    try {
      const s = normSlug(slug);
      const url = new URL(location.href);
      let changed = false;

      url.searchParams.delete("phone");
      url.searchParams.delete("tel");

      if (canExposeSlug(s)) {
        if (normSlug(url.searchParams.get("slug") || "") !== s) {
          url.searchParams.set("slug", s);
          changed = true;
        }
      } else {
        if (url.searchParams.has("slug")) {
          url.searchParams.delete("slug");
          changed = true;
        }
        if (url.searchParams.has("identifiant")) {
          url.searchParams.delete("identifiant");
          changed = true;
        }
      }

      if (changed || location.search.includes("phone=") || location.search.includes("tel=")) {
        history.replaceState({}, "", url.pathname + url.search + url.hash);
      }
    } catch (_) {}
  }

  async function resolveSubBySlug(slug) {
    const s = normSlug(slug);
    if (!s) return null;

    const tries = [
      {
        select: "phone,slug,module",
        slug: `eq.${s}`,
        module: `eq.${MODULE}`,
        limit: "1"
      },
      {
        select: "phone,slug,module",
        slug: `eq.${s}`,
        module: `eq.${MODULE_LOWER}`,
        limit: "1"
      },
      {
        select: "phone,slug,module",
        slug: `eq.${s}`,
        limit: "1"
      }
    ];

    for (const params of tries) {
      const res = await tableGet(CFG.TABLES.SUBSCRIPTIONS_PUBLIC, params);
      if (!res.ok || !Array.isArray(res.data) || !res.data[0]) continue;

      return {
        slug: normSlug(res.data[0].slug),
        phone: normPhone(res.data[0].phone),
        module: upper(res.data[0].module || MODULE)
      };
    }

    return null;
  }

  async function resolveSubByPhone(phone) {
    const p = normPhone(phone);
    if (!p) return null;

    const tries = [
      {
        select: "phone,slug,module",
        phone: `eq.${p}`,
        module: `eq.${MODULE}`,
        limit: "1"
      },
      {
        select: "phone,slug,module",
        phone: `eq.${p}`,
        module: `eq.${MODULE_LOWER}`,
        limit: "1"
      },
      {
        select: "phone,slug,module",
        phone: `eq.${p}`,
        limit: "1"
      }
    ];

    for (const params of tries) {
      const res = await tableGet(CFG.TABLES.SUBSCRIPTIONS_PUBLIC, params);
      if (!res.ok || !Array.isArray(res.data) || !res.data[0]) continue;

      return {
        slug: normSlug(res.data[0].slug),
        phone: normPhone(res.data[0].phone),
        module: upper(res.data[0].module || MODULE)
      };
    }

    return null;
  }

  async function checkAccess(phone) {
    const p = normPhone(phone);
    if (!p) return false;

    const tries = [
      { p_phone: p, p_module: MODULE },
      { p_phone: p, p_module: MODULE_LOWER },
      { phone: p, module: MODULE },
      { phone: p, module: MODULE_LOWER }
    ];

    for (const body of tries) {
      const res = await rpc(CFG.RPC.HAS_ACCESS, body);
      if (!res.ok) continue;

      if (res.data === true) return true;
      if (res.data?.ok === true) return true;
      if (res.data?.access === true) return true;
      if (res.data?.has_access === true) return true;
    }

    return false;
  }

  function parseVerifyPinPayload(data, fallbackPhone = "") {
    const raw = Array.isArray(data) ? data[0] : data;
    if (!raw) return null;

    if (typeof raw === "object" && !Array.isArray(raw)) {
      if (raw.ok === true) {
        return {
          ok: true,
          phone: normPhone(raw.phone || raw.p_phone || fallbackPhone || ""),
          module: upper(raw.module || raw.p_module || MODULE),
          owner_id: raw.owner_id || null,
          slug: normSlug(raw.slug || raw.owner_slug || "")
        };
      }

      const vals = Object.values(raw);
      if (vals.length >= 3) {
        const okLike =
          vals[0] === true ||
          vals[0] === "t" ||
          vals[0] === "true" ||
          vals[0] === 1;

        if (okLike) {
          return {
            ok: true,
            module: upper(vals[1] || MODULE),
            phone: normPhone(vals[2] || fallbackPhone || ""),
            owner_id: vals[4] || null,
            slug: ""
          };
        }
      }
    }

    if (typeof raw === "string") {
      const txt = raw.trim();
      if (txt.startsWith("(") && txt.endsWith(")")) {
        const tupleHead = txt.match(/^\(([^,]+),([^,]+),([^,]+),?(.*)\)$/);
        if (tupleHead) {
          const okToken = String(tupleHead[1] || "").trim().replace(/^"|"$/g, "");
          const modToken = String(tupleHead[2] || "").trim().replace(/^"|"$/g, "");
          const phoneToken = String(tupleHead[3] || "").trim().replace(/^"|"$/g, "");

          const okLike =
            okToken === "t" ||
            okToken === "true" ||
            okToken === "1";

          if (okLike) {
            return {
              ok: true,
              module: upper(modToken || MODULE),
              phone: normPhone(phoneToken || fallbackPhone || ""),
              owner_id: null,
              slug: ""
            };
          }
        }
      }
    }

    return null;
  }

  async function attemptPinLoginRPCs(pin, phone) {
    const p = normPin(pin);
    const ph = normPhone(phone);

    if (!p || !ph) return null;

    const tries = [
      { p_phone: ph, p_module: MODULE, p_pin: p },
      { p_phone: ph, p_module: MODULE_LOWER, p_pin: p }
    ];

    for (const body of tries) {
      const res = await rpc(CFG.RPC.VERIFY_PIN, body);
      if (!res.ok) continue;

      const parsed = parseVerifyPinPayload(res.data, ph);
      if (!parsed?.ok) continue;

      return {
        ok: true,
        slug: normSlug(parsed.slug || ""),
        phone: normPhone(parsed.phone || ph),
        owner_id: parsed.owner_id || null
      };
    }

    return null;
  }

  const urlCtx = readUrlContext();
  const stored = readStoredSession();
  const savedSlug = readSavedSlug();
  const savedPhone = readSavedPhone();

  const state = {
    module: MODULE,
    slug: normSlug(urlCtx.slug || stored?.slug || savedSlug || ""),
    phone: normPhone(urlCtx.phone || stored?.phone || savedPhone || ""),
    owner_id: stored?.owner_id || null,

    access: false,
    access_ok: false,
    pin_session_ok: false,
    preview: true,
    ready_flag: false,
    error: null,

    source: stored
      ? "session"
      : (urlCtx.slug || urlCtx.phone)
        ? "query"
        : (savedSlug || savedPhone)
          ? "storage"
          : "none",

    verified_at: stored?.verified_at || null,
    expires_at: stored?.expires_at || null,
    validated_at: stored?.validated_at || null,
    pin_url: "",
    pay_url: ""
  };

  async function loginWithPin(identifierOrSlug, pin, explicitPhone) {
    const rawIdentifier = String(identifierOrSlug || "").trim();
    const p = normPin(pin);

    if (!p) return { ok: false, error: "PIN manquant." };

    let slug = "";
    let phone = normPhone(explicitPhone || state.phone || readSavedPhone() || "");

    const maybePhone = normPhone(rawIdentifier);
    const maybeSlug = normSlug(rawIdentifier);

    if (maybePhone && maybePhone.length >= 8) {
      phone = maybePhone;
    } else if (maybeSlug) {
      slug = maybeSlug;
    }

    if (!slug) slug = normSlug(state.slug || readSavedSlug() || "");
    if (!phone) phone = normPhone(state.phone || readSavedPhone() || "");

    if (!phone && slug) {
      const sub = await resolveSubBySlug(slug);
      phone = normPhone(sub?.phone || "");
      if (!state.slug && sub?.slug) slug = normSlug(sub.slug);
    }

    if (!slug && phone) {
      const sub = await resolveSubByPhone(phone);
      slug = normSlug(sub?.slug || "");
    }

    if (!phone) {
      return { ok: false, error: "Compte chauffeur non reconnu." };
    }

    const auth = await attemptPinLoginRPCs(p, phone);
    if (!auth?.ok) {
      return { ok: false, error: "PIN invalide." };
    }

    const finalPhone = normPhone(auth.phone || phone);
    let finalSlug = normSlug(auth.slug || slug || "");

    if (!finalSlug && finalPhone) {
      const sub = await resolveSubByPhone(finalPhone);
      finalSlug = normSlug(sub?.slug || "");
    }

    if (!finalSlug && finalPhone) {
      finalSlug = "driver-" + finalPhone;
    }

    const accessOk = await checkAccess(finalPhone);
    if (!accessOk) {
      return { ok: false, error: "Abonnement inactif." };
    }

    const saved = saveSession({
      slug: finalSlug,
      phone: finalPhone,
      owner_id: auth.owner_id || null,
      access: true,
      verified_at: nowMs(),
      validated_at: nowIso()
    });

    state.slug = saved.slug;
    state.phone = saved.phone;
    state.owner_id = saved.owner_id;
    state.access = true;
    state.access_ok = true;
    state.pin_session_ok = true;
    state.preview = false;
    state.ready_flag = true;
    state.error = null;
    state.verified_at = saved.verified_at;
    state.expires_at = saved.expires_at;
    state.validated_at = saved.validated_at;
    state.pin_url = buildPinUrl(saved);
    state.pay_url = buildPayUrl(saved);

    ensureUrlIdentity(saved.slug);
    showPage();

    return {
      ok: true,
      slug: saved.slug,
      phone: saved.phone,
      owner_id: saved.owner_id || null
    };
  }

  function logout() {
    clearAllLocalState();

    state.slug = "";
    state.phone = "";
    state.owner_id = null;
    state.access = false;
    state.access_ok = false;
    state.pin_session_ok = false;
    state.preview = true;
    state.ready_flag = false;
    state.error = null;
    state.verified_at = null;
    state.expires_at = null;
    state.validated_at = null;

    showPage();
    goPin({});
  }

  async function check(options = {}) {
    const opts = Object.assign(
      {
        redirect: true,
        preserve_validation: true
      },
      options || {}
    );

    cleanVisibleUrl(state.slug);
    removeLegacySensitiveLocal();

    const storedSession = readStoredSession();
    const persistedSlug = readSavedSlug();
    const persistedPhone = readSavedPhone();
    const currentUrlCtx = readUrlContext();

    let slug = normSlug(currentUrlCtx.slug || storedSession?.slug || state.slug || persistedSlug || "");
    let phone = normPhone(currentUrlCtx.phone || storedSession?.phone || state.phone || persistedPhone || "");
    let owner_id = storedSession?.owner_id || state.owner_id || null;

    let verifiedAt =
      parseTime(storedSession?.verified_at || state.verified_at || 0) || 0;

    let expiresAt =
      parseTime(storedSession?.expires_at || state.expires_at || 0) || 0;

    let validatedAt =
      storedSession?.validated_at || state.validated_at || null;

    state.slug = slug;
    state.phone = phone;
    state.owner_id = owner_id;
    state.verified_at = verifiedAt;
    state.expires_at = expiresAt;
    state.validated_at = validatedAt;
    state.pin_url = buildPinUrl({ slug, phone });
    state.pay_url = buildPayUrl({ slug, phone });
    state.error = null;

    if (slug) saveSlugOnly(slug);
    if (phone) savePhoneOnly(phone);

    if (slug && !phone) {
      const sub = await resolveSubBySlug(slug);
      if (sub?.phone) {
        phone = normPhone(sub.phone);
        state.phone = phone;
        savePhoneOnly(phone);
      }
    }

    if (phone && !slug) {
      const sub = await resolveSubByPhone(phone);
      if (sub?.slug) {
        slug = normSlug(sub.slug);
        state.slug = slug;
        saveSlugOnly(slug);
      }
    }

    state.pin_url = buildPinUrl({ slug, phone });
    state.pay_url = buildPayUrl({ slug, phone });

    const freshSession =
      (expiresAt && nowMs() < expiresAt) ||
      (!!verifiedAt && isRecent(verifiedAt)) ||
      (!!validatedAt && isRecent(validatedAt));

    if (storedSession && freshSession) {
      state.access = true;
      state.access_ok = true;
      state.pin_session_ok = true;
      state.preview = false;
      state.ready_flag = true;
      state.error = null;

      const saved = saveSession({
        slug,
        phone,
        owner_id,
        access: true,
        verified_at: verifiedAt || nowMs(),
        expires_at: expiresAt || (nowMs() + CFG.SESSION_MAX_AGE_MS),
        validated_at: validatedAt || nowIso()
      });

      state.slug = saved.slug;
      state.phone = saved.phone;
      state.owner_id = saved.owner_id;
      state.verified_at = saved.verified_at;
      state.expires_at = saved.expires_at;
      state.validated_at = saved.validated_at;
      state.pin_url = buildPinUrl(saved);
      state.pay_url = buildPayUrl(saved);

      ensureUrlIdentity(saved.slug);
      showPage();

      return { ...state };
    }

    if (!opts.preserve_validation) {
      clearSessionsOnly();
    } else {
      clearSessionsOnly();
      if (slug) saveSlugOnly(slug);
      if (phone) savePhoneOnly(phone);
    }

    state.access = false;
    state.access_ok = false;
    state.pin_session_ok = false;
    state.preview = true;
    state.ready_flag = true;
    state.error = slug || phone ? "Session PIN absente ou expirée." : "Identité absente.";
    state.pin_url = buildPinUrl({ slug, phone });
    state.pay_url = buildPayUrl({ slug, phone });

    showPage();

    if (opts.redirect !== false && !isLoginPage()) {
      goPin({ slug, phone });
    }

    return { ...state };
  }

  function ready(options = {}) {
    const opts = Object.assign(
      {
        redirect: true,
        preserve_validation: true
      },
      options || {}
    );

    if (opts.redirect !== false && !isLoginPage() && !isPublicEntryPage()) {
      hidePage();
    }

    if (state.ready_flag) {
      showPage();
      return Promise.resolve({ ...state });
    }

    if (!pendingPromise) {
      pendingPromise = check(opts).finally(() => {
        pendingPromise = null;
      });
    }

    return pendingPromise;
  }

  function go(target, mode) {
    const finalTarget = buildSafeUrl(target || location.href, {
      slug: canExposeSlug(state.slug) ? state.slug : ""
    });

    if (mode === "replace") location.replace(finalTarget);
    else location.assign(finalTarget);
  }

  window.DIGIY_GUARD = {
    VERSION: "driver-guard-security-v2-20260504",
    state,

    ready,

    async refresh(options = {}) {
      state.ready_flag = false;
      state.error = null;
      pendingPromise = null;
      return ready(options);
    },

    getSession() {
      return { ...state };
    },

    getSlug() {
      return normSlug(state.slug || "");
    },

    getPhone() {
      return normPhone(state.phone || "");
    },

    getOwnerId() {
      return state.owner_id || null;
    },

    getModule() {
      return MODULE;
    },

    isAuthenticated() {
      return !!state.access_ok;
    },

    rememberIdentity(payload = {}) {
      return rememberIdentity(payload);
    },

    saveSession(payload = {}) {
      const saved = saveSession(payload);

      state.slug = saved.slug;
      state.phone = saved.phone;
      state.owner_id = saved.owner_id || null;
      state.access = !!saved.access;
      state.access_ok = !!saved.access;
      state.pin_session_ok = !!saved.access;
      state.preview = !saved.access;
      state.verified_at = saved.verified_at;
      state.expires_at = saved.expires_at;
      state.validated_at = saved.validated_at;
      state.ready_flag = true;
      state.error = null;
      state.pin_url = buildPinUrl(saved);
      state.pay_url = buildPayUrl(saved);

      ensureUrlIdentity(saved.slug);
      return saved;
    },

    clearSession() {
      clearSessionsOnly();
      state.access = false;
      state.access_ok = false;
      state.pin_session_ok = false;
      state.preview = true;
      state.ready_flag = false;
      state.error = null;
    },

    clearAll() {
      clearAllLocalState();
      state.access = false;
      state.access_ok = false;
      state.pin_session_ok = false;
      state.preview = true;
      state.ready_flag = false;
      state.error = null;
      state.slug = "";
      state.phone = "";
      state.owner_id = null;
      state.verified_at = null;
      state.expires_at = null;
      state.validated_at = null;
      cleanVisibleUrl();
    },

    loginWithPin,
    logout,

    buildPinUrl(input = {}) {
      return buildPinUrl({ ...state, ...input });
    },

    goPin(input = {}) {
      goPin({ ...state, ...input });
    },

    buildPayUrl(input = {}) {
      return buildPayUrl({ ...state, ...input });
    },

    goPay(input = {}) {
      goPay({ ...state, ...input });
    },

    buildUrl(path, params = {}) {
      return buildSafeUrl(path, params);
    },

    go,

    cleanUrl() {
      cleanVisibleUrl(state.slug);
    },

    getSb,

    async resolveSubBySlug(slug) {
      return resolveSubBySlug(slug);
    },

    async resolveSubByPhone(phone) {
      return resolveSubByPhone(phone);
    },

    async checkAccess(phone) {
      return checkAccess(phone || state.phone || "");
    }
  };

  cleanVisibleUrl(state.slug);

  if (isPublicEntryPage() || isLoginPage()) {
    ready({ redirect: false }).catch(() => showPage());
  } else {
    ready({ redirect: true }).catch(() => showPage());
  }
})();
