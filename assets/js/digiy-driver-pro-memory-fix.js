/* =========================================================
   DIGIY DRIVER PRO — DOUBLE MÉMOIRE TRAJETS
   1) Courses programmées = pense-bête chauffeur PRO
   2) Trajets proposés = programme public / fiche client
   Local robuste d'abord, Supabase ensuite.
   ========================================================= */
(function(){
  "use strict";

  if(window.DIGIY_DRIVER_PRO_MEMORY_READY) return;
  window.DIGIY_DRIVER_PRO_MEMORY_READY = true;

  var KEYS = {
    scheduled: "DIGIY_DRIVER_PRO_SCHEDULED_TRIPS",
    localTrips: "DIGIY_DRIVER_PRO_LOCAL_TRIPS",
    proposed: "DIGIY_DRIVER_PRO_PUBLIC_ROUTES",
    tarifs: "DIGIY_DRIVER_PRO_TARIFS",
    prices: "DIGIY_DRIVER_PRO_PRICES",
    signals: "DIGIY_DRIVER_PRO_SIGNALS",
    snapshot: "DIGIY_DRIVER_PRO_SYNC_SNAPSHOT_V1"
  };

  var LEGACY_KEYS = {
    scheduled: "DIGIY_DRIVER_SCHEDULED_TRIPS",
    localTrips: "DIGIY_DRIVER_LOCAL_TRIPS",
    proposed: "DIGIY_DRIVER_PUBLIC_ROUTES",
    tarifs: "DIGIY_DRIVER_TARIFS",
    prices: "DIGIY_DRIVER_PRICES",
    signals: "DIGIY_DRIVER_PRO_SIGNALS",
    snapshot: "DIGIY_DRIVER_SYNC_SNAPSHOT_V1"
  };

  function readJson(key, fallback){
    try{
      var raw = localStorage.getItem(key);
      if(!raw) return fallback;
      var parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    }catch(_){
      return fallback;
    }
  }

  function writeJson(key, value){
    try{
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    }catch(e){
      console.warn("[DIGIY DRIVER PRO MEMORY] impossible d'écrire", key, e && e.message ? e.message : e);
      return false;
    }
  }

  function writeBoth(proKey, legacyKey, value){
    writeJson(proKey, value);
    if(legacyKey && legacyKey !== proKey){
      writeJson(legacyKey, value);
    }
  }

  function readBoth(proKey, legacyKey, fallback){
    var pro = readJson(proKey, null);
    if(pro != null) return pro;

    var legacy = readJson(legacyKey, null);
    if(legacy != null) return legacy;

    return fallback;
  }

  function idFrom(text){
    return String(text || "")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .replace(/[^a-z0-9]+/g,"-")
      .replace(/^-|-$/g,"")
      .slice(0,80) || ("id-" + Date.now());
  }

  function now(){
    return new Date().toISOString();
  }

  function list(pairs){
    var out = [];
    pairs.forEach(function(pair){
      var rows = readBoth(pair[0], pair[1], []);
      if(Array.isArray(rows)) out = out.concat(rows);
    });
    return out;
  }

  function dedupe(rows){
    var map = new Map();

    rows.forEach(function(row){
      if(!row) return;

      var key = String(
        row.id ||
        row.route_id ||
        row.label ||
        row.route_label ||
        row.pickup_at ||
        Math.random()
      );

      map.set(key, Object.assign({}, map.get(key) || {}, row));
    });

    return Array.from(map.values());
  }

  function rememberSignal(type, label, message, href){
    var rows = readBoth(KEYS.signals, LEGACY_KEYS.signals, []);
    if(!Array.isArray(rows)) rows = [];

    rows.push({
      id: String(Date.now()) + "-" + Math.random().toString(16).slice(2),
      module: "DRIVER",
      side: "PRO",
      source: "driver-pro-memory",
      type: type || "memoire",
      label: label || "Mémoire DRIVER PRO",
      message: message || "",
      href: href || "./hub.html",
      created_at: now()
    });

    writeBoth(KEYS.signals, LEGACY_KEYS.signals, rows.slice(-120));
  }

  function updateSnapshot(patch){
    var old = readBoth(KEYS.snapshot, LEGACY_KEYS.snapshot, {});

    var next = Object.assign({}, old || {}, patch || {}, {
      module: "DRIVER",
      side: "PRO",
      saved_at: now()
    });

    writeBoth(KEYS.snapshot, LEGACY_KEYS.snapshot, next);
    return next;
  }

  function normalizeScheduled(trip){
    var t = trip || {};

    var id = String(t.id || t.trip_id || t.ref || "").trim() ||
      idFrom([t.client_name, t.pickup_label, t.dropoff_label, t.pickup_at].filter(Boolean).join("-")) + "-" + Date.now();

    return Object.assign({}, t, {
      id: id,
      module: "DRIVER",
      side: "PRO",
      memory_type: "scheduled_trip",
      source: t.source || "trajets-programmer",
      client_name: String(t.client_name || t.client || "").trim(),
      client_phone: String(t.client_phone || "").trim(),
      pickup_label: String(t.pickup_label || t.depart || t.from || "").trim(),
      dropoff_label: String(t.dropoff_label || t.arrivee || t.to || "").trim(),
      pickup_zone: String(t.pickup_zone || t.zone || "").trim(),
      pickup_at: String(t.pickup_at || t.date || "").trim(),
      price_fcfa: Number(t.price_fcfa || t.amount_fcfa || t.amount || 0) || 0,
      status: String(t.status || "requested").trim(),
      note: String(t.note || "").trim(),
      updated_at: now(),
      created_at: t.created_at || now()
    });
  }

  function saveScheduledTrip(trip){
    var item = normalizeScheduled(trip);

    var rows = dedupe(
      list([
        [KEYS.scheduled, LEGACY_KEYS.scheduled],
        [KEYS.localTrips, LEGACY_KEYS.localTrips]
      ]).concat([item])
    );

    writeBoth(KEYS.scheduled, LEGACY_KEYS.scheduled, rows.slice(-150));
    writeBoth(KEYS.localTrips, LEGACY_KEYS.localTrips, rows.slice(-150));

    var oldSnapshot = readBoth(KEYS.snapshot, LEGACY_KEYS.snapshot, {});
    var oldSummary = oldSnapshot.summary || {};
    var oldCounts = oldSummary.counts || {};

    updateSnapshot({
      scheduledTrips: rows.slice(-150),
      localTrips: rows.slice(-150),
      summary: Object.assign({}, oldSummary, {
        counts: Object.assign({}, oldCounts, {
          scheduledTrips: rows.length,
          trips: rows.length
        })
      })
    });

    rememberSignal(
      "course_programmee",
      "Course programmée gardée",
      [item.client_name || "Client", item.pickup_label, item.dropoff_label].filter(Boolean).join(" → "),
      "./trajets-complet.html"
    );

    try{
      window.dispatchEvent(new CustomEvent("digiy:driver:pro:scheduled-trip:saved", { detail:item }));
      window.dispatchEvent(new CustomEvent("digiy:driver:scheduled-trip:saved", { detail:item }));
    }catch(_){}

    return item;
  }

  function normalizeProposed(route){
    var r = route || {};
    var label = String(r.label || r.route_label || r.name || r.title || "").trim();
    var id = String(r.id || r.route_id || "").trim() || idFrom(label);

    return Object.assign({}, r, {
      id: id,
      module: "DRIVER",
      side: "PRO",
      memory_type: "proposed_route",
      source: r.source || "profile-edition",
      label: label || "Trajet proposé",
      route_label: label || "Trajet proposé",
      amount: Number(r.amount || r.price_fcfa || r.price || r.tarif || 0) || 0,
      price_fcfa: Number(r.amount || r.price_fcfa || r.price || r.tarif || 0) || 0,
      vehicle: String(r.vehicle || r.vehicle_type || r.car || "").trim(),
      note: String(r.note || r.description || "").trim(),
      tags: Array.isArray(r.tags) ? r.tags : [],
      updated_at: now(),
      created_at: r.created_at || now()
    });
  }

  function saveProposedRoute(route){
    var item = normalizeProposed(route);

    var rows = dedupe(
      list([
        [KEYS.proposed, LEGACY_KEYS.proposed],
        [KEYS.tarifs, LEGACY_KEYS.tarifs],
        [KEYS.prices, LEGACY_KEYS.prices]
      ]).concat([item])
    ).filter(function(r){
      return String(r.label || r.route_label || "").trim();
    });

    writeBoth(KEYS.proposed, LEGACY_KEYS.proposed, rows.slice(-150));
    writeBoth(KEYS.tarifs, LEGACY_KEYS.tarifs, rows.slice(-150));
    writeBoth(KEYS.prices, LEGACY_KEYS.prices, rows.slice(-150));

    var oldSnapshot = readBoth(KEYS.snapshot, LEGACY_KEYS.snapshot, {});
    var oldSummary = oldSnapshot.summary || {};
    var oldCounts = oldSummary.counts || {};

    updateSnapshot({
      publicRoutes: rows.slice(-150),
      tarifs: rows.slice(-150),
      summary: Object.assign({}, oldSummary, {
        tarifs: rows.slice(-150),
        counts: Object.assign({}, oldCounts, {
          publicRoutes: rows.length,
          tarifs: rows.length
        })
      })
    });

    rememberSignal(
      "trajet_propose",
      "Trajet proposé gardé",
      item.label + (item.amount ? " · " + item.amount.toLocaleString("fr-FR") + " FCFA" : ""),
      "./profil-chauffeur.html"
    );

    try{
      window.dispatchEvent(new CustomEvent("digiy:driver:pro:proposed-route:saved", { detail:item }));
      window.dispatchEvent(new CustomEvent("digiy:driver:proposed-route:saved", { detail:item }));
    }catch(_){}

    return item;
  }

  function readScheduledTrips(){
    return dedupe(
      list([
        [KEYS.scheduled, LEGACY_KEYS.scheduled],
        [KEYS.localTrips, LEGACY_KEYS.localTrips]
      ])
    );
  }

  function readProposedRoutes(){
    return dedupe(
      list([
        [KEYS.proposed, LEGACY_KEYS.proposed],
        [KEYS.tarifs, LEGACY_KEYS.tarifs],
        [KEYS.prices, LEGACY_KEYS.prices]
      ])
    ).filter(function(r){
      return String(r.label || r.route_label || "").trim();
    });
  }

  window.DIGIY_DRIVER_PRO_MEMORY = {
    keys: KEYS,
    legacyKeys: LEGACY_KEYS,
    readJson: readJson,
    writeJson: writeJson,
    readScheduledTrips: readScheduledTrips,
    saveScheduledTrip: saveScheduledTrip,
    readProposedRoutes: readProposedRoutes,
    saveProposedRoute: saveProposedRoute,
    rememberSignal: rememberSignal,
    updateSnapshot: updateSnapshot
  };

  /*
    Compatibilité avec les fichiers déjà posés :
    les anciennes pages appellent parfois DIGIY_DRIVER_MEMORY.
    On garde l’alias pour ne rien casser.
  */
  window.DIGIY_DRIVER_MEMORY = window.DIGIY_DRIVER_PRO_MEMORY;

})();
