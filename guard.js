// guard-pro.js — DIGIY PAY compatible (slug-first)
(() => {
  const SUPABASE_URL  = "https://XXXX.supabase.co";
  const SUPABASE_ANON = "XXXX_ANON_KEY";
  const MODULE_CODE = "DRIVER";

  const qs = new URLSearchParams(location.search);
  const slug  = qs.get("slug")  || "";
  const phoneQ = qs.get("phone") || "";

  async function rpc(name, params) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_ANON,
        "Authorization": `Bearer ${SUPABASE_ANON}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(params)
    });
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data: j };
  }

  async function resolvePhoneFromSlug(s) {
    // view publique minimaliste: digiy_subscriptions_public (phone,module,slug)
    const url = `${SUPABASE_URL}/rest/v1/digiy_subscriptions_public?select=phone,module,slug&slug=eq.${encodeURIComponent(s)}&limit=1`;
    const r = await fetch(url, {
      headers: { "apikey": SUPABASE_ANON, "Authorization": `Bearer ${SUPABASE_ANON}` }
    });
    const arr = await r.json().catch(() => []);
    if (!r.ok || !Array.isArray(arr) || !arr[0]?.phone) return "";
    return String(arr[0].phone);
  }

  async function go() {
    let phone = phoneQ;

    if (!phone && slug) {
      phone = await resolvePhoneFromSlug(slug);
    }

    // rien -> ABOS
    if (!phone) {
      window.location.href =
        "https://beauville.github.io/abos/?module=" + encodeURIComponent(MODULE_CODE);
      return;
    }

    // check access
    const res = await rpc("digiy_has_access", { p_phone: phone, p_module: MODULE_CODE });

    if (res.ok && res.data === true) return; // ✅ accès OK

    // ❌ pas accès -> ABOS
    window.location.href =
      "https://beauville.github.io/abos/?module=" + encodeURIComponent(MODULE_CODE) +
      "&phone=" + encodeURIComponent(phone);
  }

  go();
})();
