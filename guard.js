/* =========================
   DIGIY DRIVER PRO — GUARD SIMPLIFIÉ
   Slug + PIN (4 derniers chiffres) → owner_id → Session 8h
========================= */
(function () {
  "use strict";

  console.log("🔐 DIGIY_GUARD → Démarrage...");

  // =============================
  // SUPABASE
  // =============================
  const SUPABASE_URL = "https://wesqmwjjtsefyjnluosj.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indlc3Ftd2pqdHNlZnlqbmx1b3NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNzg4ODIsImV4cCI6MjA4MDc1NDg4Mn0.dZfYOc2iL2_wRYL3zExZFsFSBK6AbMeOid2LrIjcTdA";

  const SESSION_KEY = "DIGIY_DRIVER_PRO_SESSION";
  const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8h

  function now() { return Date.now(); }

  // =============================
  // SESSION
  // =============================
  function getSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) {
        console.log("🔐 Pas de session stockée");
        return null;
      }
      const s = JSON.parse(raw);
      if (!s || !s.expires_at || now() > s.expires_at) {
        console.log("🔐 Session expirée");
        return null;
      }
      console.log("🔐 Session valide trouvée:", s.owner_id);
      return s;
    } catch (err) {
      console.error("🔐 Erreur lecture session:", err);
      return null;
    }
  }

  function setSession(data) {
    const session = {
      ...data,
      created_at: now(),
      expires_at: now() + SESSION_TTL_MS
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    console.log("🔐 Session créée:", session.owner_id);
    return session;
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    console.log("🔐 Session supprimée");
  }

  // =============================
  // SUPABASE
  // =============================
  function getSb() {
    if (!window.supabase?.createClient) {
      console.error("🔐 Supabase non disponible");
      return null;
    }
    if (!window.__digiy_sb__) {
      window.__digiy_sb__ = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log("🔐 Client Supabase créé");
    }
    return window.__digiy_sb__;
  }

  // =============================
  // LOGIN AVEC SLUG + PIN (4 derniers chiffres)
  // =============================
  async function loginWithPin(slug, pin) {
    console.log("🔐 Tentative login:", slug);
    const sb = getSb();
    if (!sb) return { ok: false, error: "Supabase non initialisé" };

    slug = (slug || "").trim();
    pin = (pin || "").trim();

    if (!slug || !pin) return { ok: false, error: "Slug et PIN requis" };

    // ✅ Appel RPC verify_access_pin(slug, pin)
    const { data, error } = await sb.rpc("verify_access_pin", {
      p_slug: slug,
      p_pin: pin
    });

    if (error) {
      console.error("🔐 Erreur RPC:", error);
      return { ok: false, error: error.message };
    }

    // Parse si string JSON
    const result = typeof data === "string" ? JSON.parse(data) : data;

    if (!result?.ok || !result?.owner_id) {
      console.error("🔐 Réponse invalide:", result);
      return { ok: false, error: result?.error || "PIN invalide" };
    }

    // ✅ STOCKER owner_id + infos en session
    const session = setSession({
      ok: true,
      owner_id: result.owner_id,
      slug: result.slug,
      title: result.title,
      phone: result.phone
    });

    console.log("🔐 Login OK:", session);
    return { ok: true, session };
  }

  // =============================
  // PROTECTION DE PAGE
  // =============================
  function requireSession(redirect = "pin.html") {
    const s = getSession();
    if (!s || !s.owner_id) {
      console.log("🔐 Session requise, redirection vers:", redirect);
      location.replace(redirect);
      return null;
    }
    console.log("🔐 Session OK pour cette page");
    return s;
  }

  // =============================
  // LOGOUT
  // =============================
  function logout(redirect = "index.html") {
    clearSession();
    console.log("🔐 Logout, redirection vers:", redirect);
    location.replace(redirect);
  }

  // =============================
  // EXPORT
  // =============================
  window.DIGIY_GUARD = {
    loginWithPin,
    requireSession,
    logout,
    getSession,
    getSb
  };

  console.log("✅ DIGIY_GUARD chargé et prêt !");
  
  // ✅ Dispatch event pour signaler que GUARD est prêt
  window.dispatchEvent(new Event('DIGIY_GUARD_READY'));

})();
