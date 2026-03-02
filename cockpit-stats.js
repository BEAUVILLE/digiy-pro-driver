// cockpit-stats.js
(function(){
  "use strict";

  const money = (n) => `${Number(n || 0).toLocaleString("fr-FR")} FCFA`;

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = (val ?? "—");
  };

  async function load(){
    try{
      if(!window.DIGIY_GUARD?.rpc) {
        console.warn("DIGIY_GUARD.rpc not ready");
        return;
      }

      const slug = new URLSearchParams(location.search).get("slug");
      if(!slug) {
        console.warn("No slug in URL");
        return;
      }

      const res = await window.DIGIY_GUARD.rpc(
        "cockpit_driver_stats_by_slug",
        { p_slug: slug }
      );

      const data = res?.data ?? res;
      const s = Array.isArray(data) ? data[0] : data;

      if(!s) return;

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
      set("kpiLastTripAt",
        s.last_trip_at
          ? new Date(s.last_trip_at).toLocaleString("fr-FR")
          : "—"
      );

    } catch(e){
      console.error("cockpit-stats load error:", e);
    }
  }

  document.addEventListener("DOMContentLoaded", load);

  window.DIGIY_COCKPIT_STATS = { load };

})();
