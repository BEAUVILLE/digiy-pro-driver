// cockpit-stats.js — SAFE READY (attend guard.ready avant RPC)
(function () {
  "use strict";

  const money = (n) => `${Number(n || 0).toLocaleString("fr-FR")} FCFA`;

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = (val ?? "—");
  };

  const getSlug = () => {
    try { return new URLSearchParams(location.search).get("slug") || ""; }
    catch (_) { return ""; }
  };

  async function waitGuardReady(timeoutMs = 8000) {
    const g = window.DIGIY_GUARD;
    if (!g?.ready) return null;

    // timeout propre (évite de “pendre” si un script manque)
    let t = null;
    const timeout = new Promise((resolve) => {
      t = setTimeout(() => resolve({ ok: false, reason: "timeout" }), timeoutMs);
    });

    const res = await Promise.race([g.ready, timeout]).catch(() => ({ ok: false, reason: "crash" }));
    if (t) clearTimeout(t);
    return res;
  }

  async function load() {
    try {
      const g = window.DIGIY_GUARD;

      // 1) attend le guard (session + access check)
      const sess = await waitGuardReady(9000);

      // Si guard absent → on ne fait rien (le HTML/guard doit être corrigé)
      if (!g?.rpc || !sess) {
        console.warn("[cockpit-stats] guard missing or not ready");
        return;
      }

      // Si pas accès → le guard redirige normalement vers PAY (donc on stop ici)
      if (!sess.ok) {
        console.warn("[cockpit-stats] no access:", sess.reason);
        return;
      }

      // 2) slug (priorité: session.slug, sinon URL)
      const slug = (sess.slug || getSlug()).trim();
      if (!slug) {
        console.warn("[cockpit-stats] missing slug");
        return;
      }

      // 3) RPC stats
      const res = await g.rpc("cockpit_driver_stats_by_slug", { p_slug: slug });

      const data = res?.data ?? res;
      const s = Array.isArray(data) ? data[0] : data;
      if (!s) return;

      set("kpiTripsToday", s.trips_today ?? 0);
      set("kpiRevenueToday", money(s.revenue_today_fcfa));

      set("kpiTrips7d", s.trips_7d ?? 0);
      set("kpiRevenue7d", money(s.revenue_7d_fcfa));

      set("kpiTrips30d", s.trips_30d ?? 0);
      set("kpiRevenue30d", money(s.revenue_30d_fcfa));

      set("kpiTripsTotal", s.trips_total ?? 0);
      set("kpiRevenueTotal", money(s.revenue_total_fcfa));

      set("kpiDriverStatus", s.driver_status || "—");
      set("kpiZone", s.zone_slug || "—");

      set(
        "kpiLastTripAt",
        s.last_trip_at ? new Date(s.last_trip_at).toLocaleString("fr-FR") : "—"
      );
    } catch (e) {
      console.error("[cockpit-stats] load error:", e);
    }
  }

  // DOM ready
  document.addEventListener("DOMContentLoaded", load);

  // Bonus: si on revient de PAY (ou si ton wait.html fait un replace), on peut recharger
  window.addEventListener("pageshow", () => {
    // pageshow arrive après bfcache aussi -> safe
    try { load(); } catch (_) {}
  });

  window.DIGIY_COCKPIT_STATS = { load };
})();
