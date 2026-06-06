/* DIGIY DRIVER — mémoire PRO officielle
   Rôle : vrai fichier JS de mémoire locale pour ACTION DRIVER / trajets.
   Doctrine : DRIVER prépare la course, le chauffeur vérifie et valide. Rien n'est confirmé automatiquement.
*/
(function(){
  "use strict";

  var VERSION = "driver-pro-memory-official-20260606";
  var NS = "DIGIY_DRIVER_PRO";
  var KEYS = {
    session: NS + "_SESSION",
    scheduled: NS + "_SCHEDULED_TRIPS",
    notes: NS + "_ACTION_NOTES",
    payDrafts: NS + "_PAY_DRAFTS",
    latest: NS + "_LATEST_ACTION"
  };
  var MIRROR_TRIP_KEYS = [
    "DIGIY_DRIVER_PRO_SCHEDULED_TRIPS",
    "DIGIY_DRIVER_SCHEDULED_TRIPS",
    "DIGIY_DRIVER_ACTION_TRIPS",
    "DIGIY_DRIVER_TRIPS_LOCAL",
    "digiy_driver_trips"
  ];

  function now(){ return new Date().toISOString(); }
  function id(prefix){ return String(prefix || "driver") + "_" + Date.now() + "_" + Math.random().toString(16).slice(2,8); }
  function read(key, fallback){ try{ var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; } }
  function write(key, value){ try{ localStorage.setItem(key, JSON.stringify(value)); return true; }catch(_){ return false; } }
  function list(key){ var rows = read(key, []); return Array.isArray(rows) ? rows : []; }
  function text(v){ return String(v || "").trim(); }
  function amountFrom(v){ var m = String(v || "").replace(/\s+/g," ").match(/(\d[\d\s.,]*)\s*(?:f|fcfa|xof)?/i); if(!m) return null; var n = Number(String(m[1]).replace(/[^\d]/g,"")); return Number.isFinite(n) && n > 0 ? n : null; }
  function norm(v){ return String(v || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,""); }
  function channelFrom(v){ var t = norm(v); if(t.indexOf("wave") >= 0 || t.indexOf("ouev") >= 0) return "Wave"; if(t.indexOf("orange") >= 0) return "Orange Money"; if(t.indexOf("carte") >= 0) return "Carte"; if(t.indexOf("cash") >= 0 || t.indexOf("espece") >= 0 || t.indexOf("liquide") >= 0) return "Cash"; return ""; }
  function isExpense(v){ var t = norm(v); return /depense|essence|peage|carburant|sortie|fournisseur|achat/.test(t); }

  function tripId(row){ return String(row && (row.id || row.local_id || row.trip_id || row.created_at || row.createdAt || row.note || row.text) || ""); }
  function dedupe(rows, limit){
    var seen = {};
    return (Array.isArray(rows) ? rows : []).filter(function(row){
      var k = tripId(row) || id("tmp");
      if(seen[k]) return false;
      seen[k] = true;
      return true;
    }).slice(0, Number(limit || 150));
  }
  function normalizeTrip(input){
    var src = input && typeof input === "object" ? input : {note:text(input)};
    var note = text(src.note || src.text || src.raw_text || src.clean_text || src.message || "");
    var created = src.created_at || src.createdAt || now();
    var amount = Number(src.amount_fcfa || src.price_fcfa || src.amount || amountFrom(note) || 0) || 0;
    return Object.assign({}, src, {
      id: src.id || src.local_id || src.trip_id || id("driver_trip"),
      local_id: src.local_id || src.id || src.trip_id || id("driver_trip"),
      module: "DRIVER",
      source: src.source || "DIGIY_DRIVER_PRO_MEMORY",
      status: src.status || src.ride_status || "requested",
      ride_status: src.ride_status || src.status || "requested",
      client_name: src.client_name || src.client || "Client à préciser",
      pickup_label: src.pickup_label || src.departure || src.pickup_zone || "Départ à préciser",
      dropoff_label: src.dropoff_label || src.destination || "Arrivée à préciser",
      departure: src.departure || src.pickup_label || src.pickup_zone || "Départ à préciser",
      destination: src.destination || src.dropoff_label || "Arrivée à préciser",
      pickup_at: src.pickup_at || src.ride_at || "",
      ride_at: src.ride_at || src.pickup_at || "",
      amount_fcfa: amount,
      price_fcfa: amount,
      payment_mode: src.payment_mode || src.channel || channelFrom(note),
      note: note,
      text: src.text || note,
      requiresHumanValidation: src.requiresHumanValidation !== false,
      created_at: created,
      createdAt: src.createdAt || created,
      updated_at: now(),
      safety: Object.assign({
        noAutoConfirmation: true,
        noAutoPayment: true,
        driverValidationRequired: true,
        humanValidationRequired: true
      }, src.safety || {})
    });
  }
  function saveToKey(key, row, limit){
    var rows = list(key);
    rows.unshift(row);
    write(key, dedupe(rows, limit || 150));
    return row;
  }
  function mirrorTrip(row){
    MIRROR_TRIP_KEYS.forEach(function(key){ saveToKey(key, row, 150); });
    try{ localStorage.setItem("DIGIY_DRIVER_PENDING_TRIP", JSON.stringify(row)); }catch(_){ }
    try{ localStorage.setItem("DIGIY_DRIVER_LATEST_ACTION", JSON.stringify(row)); }catch(_){ }
  }

  function saveScheduledTrip(trip){
    var row = normalizeTrip(trip);
    saveToKey(KEYS.scheduled, row, 180);
    mirrorTrip(row);
    try{ window.dispatchEvent(new CustomEvent("digiy:driver:trip-saved", {detail:row})); }catch(_){ }
    return row;
  }
  function saveActionNote(input){
    var row = normalizeTrip(input);
    row.kind = "Note DRIVER";
    saveToKey(KEYS.notes, row, 180);
    try{ localStorage.setItem("DIGIY_DRIVER_PENDING_NOTE", JSON.stringify(row)); }catch(_){ }
    try{ window.dispatchEvent(new CustomEvent("digiy:driver:note-saved", {detail:row})); }catch(_){ }
    return row;
  }
  function savePayDraft(input){
    var src = input && typeof input === "object" ? input : {text:text(input)};
    var raw = text(src.text || src.note || src.raw_text || src.clean_text || "");
    var amount = Number(src.amount || src.amount_fcfa || amountFrom(raw) || 0) || 0;
    var row = Object.assign({}, src, {
      id: src.id || id("driver_pay"),
      module: "DRIVER",
      source: src.source || "DIGIY_DRIVER_PRO_MEMORY",
      target: "PAY",
      text: raw,
      note: raw,
      amount: amount || null,
      currency: amount ? "XOF" : "",
      channel: src.channel || channelFrom(raw),
      payType: src.payType || (isExpense(raw) ? "expense" : "income"),
      category: src.category || (isExpense(raw) ? "Dépense chauffeur DRIVER" : "Recette course DRIVER"),
      status: src.status || "draft_validated_by_driver",
      requiresHumanValidation: true,
      createdAt: src.createdAt || now(),
      updated_at: now(),
      safety: Object.assign({noAutoPayment:true,noAutoConfirmation:true,humanValidationRequired:true}, src.safety || {})
    });
    saveToKey(KEYS.payDrafts, row, 120);
    try{ localStorage.setItem("DIGIY_PAY_PENDING_MOVEMENT", JSON.stringify(row)); }catch(_){ }
    try{ localStorage.setItem("DIGIY_DRIVER_PAY_BRIDGE", JSON.stringify(row)); }catch(_){ }
    try{ localStorage.setItem("DIGIY_DRIVER_LATEST_ACTION", JSON.stringify(row)); }catch(_){ }
    try{ window.dispatchEvent(new CustomEvent("digiy:driver:pay-draft-saved", {detail:row})); }catch(_){ }
    return row;
  }
  function rememberSession(session){
    var row = Object.assign({}, session || {}, {module:"DRIVER", source:"DIGIY_DRIVER_PRO_MEMORY", updated_at:now()});
    write(KEYS.session, row);
    return row;
  }
  function clear(kind){
    var map = {scheduled:KEYS.scheduled, trips:KEYS.scheduled, notes:KEYS.notes, pay:KEYS.payDrafts, payDrafts:KEYS.payDrafts};
    if(!map[kind]) return false;
    write(map[kind], []);
    return true;
  }

  var API = {
    version: VERSION,
    keys: Object.assign({}, KEYS),
    rememberSession: rememberSession,
    session: function(){ return read(KEYS.session, {}); },
    saveScheduledTrip: saveScheduledTrip,
    saveTrip: saveScheduledTrip,
    scheduledTrips: function(){ return list(KEYS.scheduled); },
    trips: function(){ return list(KEYS.scheduled); },
    saveActionNote: saveActionNote,
    saveNote: saveActionNote,
    notes: function(){ return list(KEYS.notes); },
    savePayDraft: savePayDraft,
    payDrafts: function(){ return list(KEYS.payDrafts); },
    latest: function(){ return read("DIGIY_DRIVER_LATEST_ACTION", null); },
    clear: clear
  };

  window.DIGIY_DRIVER_PRO_MEMORY = API;
  window.DIGIY_DRIVER_MEMORY = window.DIGIY_DRIVER_MEMORY || API;
  try{ window.dispatchEvent(new CustomEvent("digiy:driver-pro-memory-ready", {detail:{version:VERSION}})); }catch(_){ }
})();
