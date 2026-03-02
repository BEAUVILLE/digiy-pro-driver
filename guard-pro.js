// guard-pro.js — DIGIY PRO access gate (slug-first) -> commencer-a-payer (ANTI-BOUCLE)
(() => {
  "use strict";

  // =========================
  // ✅ CONFIG
  // =========================
  const SUPABASE_URL = "https://wesqmwjjtsefyjnluosj.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indlc3Ftd2pqdHNlZnlqbmx1b3NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNzg4ODIsImV4cCI6MjA4MDc1NDg4Mn0.dZfYOc2iL2_wRYL3zExZFsFSBK6AbMeOid2LrIjcTdA";

  // ✅ À CHANGER PAR MODULE
  const MODULE_CODE = "DRIVER"; // DRIVER, LOC, RESTO, POS, etc.

  // ✅ ABOS (tunnel paiement)
  const PAY_URL = "https://commencer-a-payer.digiylyfe.com/";

  // ✅ PRO ENTRY (retour SAFE — jamais pin.html)
  const PRO_ENTRY_URL = "https://pro-driver.digiylyfe.com/";

  // =========================
  // ✅ URL params
  // =========================
  const qs = new URLSearchParams(location.search);
  const slugQ  = (qs.get("slug")  || "").trim();
  const phoneQ = (qs.get("phone") || "").trim();

  // =========================
  // ✅ Helpers
  // =========================
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

    // view publique: digiy_subscriptions_public (phone,slug,module)
    const url =
      `${SUPABASE_URL}/rest/v1/digiy_subscriptions_public` +
      `?select=phone,slug,module&slug=eq.${encodeURIComponent(s)}&limit=1`;

    const r = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    const arr = await r.json().catch(() => []);
    if (!r.ok || !Array.isArray(arr) || !arr[0]?.phone) return "";
    return String(arr[0].phone);
  }

  function buildReturnUrl({ phone, slug }) {
    // ✅ Retour SAFE: entrée PRO (JAMAIS pin.html)
    const p = normPhone(phone);
    const s = normSlug(slug);

    const back = new URL(PRO_ENTRY_URL);
    // On met toujours un slug, car l'entrée pro sait router
    if (s) back.searchParams.set("slug", s);
    else if (p) back.searchParams.set("slug", `driver-${p}`);

    return back.toString();
  }

  function goPay({ phone, slug }) {
    // ✅ éviter boucle si déjà sur ABOS
    try {
      if (location.href.startsWith(PAY_URL)) return;
    } catch (_) {}

    const p = normPhone(phone);
    const s = normSlug(slug);

    const u = new URL(PAY_URL);
    u.searchParams.set("module", MODULE_CODE);
    if (p) u.searchParams.set("phone", p);
    if (s) u.searchParams.set("slug", s);

    // ✅ return SAFE
    u.searchParams.set("return", buildReturnUrl({ phone: p, slug: s }));

    location.replace(u.toString());
  }

  // =========================
  // ✅ Main
  // =========================
  async function main() {
    const slug = normSlug(slugQ);
    let phone = normPhone(phoneQ);

    // slug-first : si pas de phone, on résout via slug
    if (!phone && slug) {
      phone = normPhone(await resolvePhoneFromSlug(slug));
    }

    // rien -> ABOS direct
    if (!phone) {
      goPay({ phone: "", slug });
      return;
    }

    // check access (truth backend)
    const res = await rpc("digiy_has_access", { p_phone: phone, p_module: MODULE_CODE });

    // ✅ accès OK -> on laisse la page continuer
    if (res.ok && res.data === true) return;

    // ❌ pas accès -> ABOS
    goPay({ phone, slug });
  }

  main().catch(() => {
    // réseau down -> ABOS safe
    goPay({ phone: phoneQ, slug: slugQ });
  });
})();
