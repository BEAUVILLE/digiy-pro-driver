(() => {
  "use strict";

  const CFG = {
    url: window.DIGIY_SUPABASE_URL || "https://wesqmwjjtsefyjnluosj.supabase.co",
    key: window.DIGIY_SUPABASE_ANON_KEY || window.DIGIY_SUPABASE_ANON || "",
    pin: window.DIGIY_LOGIN_URL || "./pin.html",
    sessionKeys: [
      "digiy_driver_session",
      "digiy_driver_guard_session",
      "digiy_guard_driver_session",
      "DIGIY_DRIVER_PIN_SESSION",
      "DIGIY_PIN_SESSION",
      "DIGIY_ACCESS",
      "DIGIY_SESSION_DRIVER",
      "digiy_guard_session"
    ]
  };

  let client = null;

  function parseJson(raw){
    try{return JSON.parse(raw)}catch(_){return null}
  }

  function parseTime(value){
    if(value == null || value === "") return 0;
    if(typeof value === "number") return value < 100000000000 ? value * 1000 : value;
    if(/^\d+$/.test(String(value))) {
      const n = Number(value);
      return n < 100000000000 ? n * 1000 : n;
    }
    const n = Date.parse(String(value));
    return Number.isFinite(n) ? n : 0;
  }

  function readStoredSession(){
    for(const key of CFG.sessionKeys){
      for(const storage of [sessionStorage, localStorage]){
        try{
          const parsed = parseJson(storage.getItem(key) || "");
          if(!parsed || typeof parsed !== "object") continue;
          const moduleName = String(parsed.module || parsed.module_code || "DRIVER").toUpperCase();
          if(moduleName !== "DRIVER") continue;
          const token = String(parsed.session_token || parsed.token || "").trim();
          const expiresAt = parseTime(parsed.expires_at || parsed.expiresAt || 0);
          if(!token) continue;
          if(expiresAt && Date.now() >= expiresAt) continue;
          return {
            key,
            token,
            slug:String(parsed.slug || "").trim(),
            phone:String(parsed.phone || "").replace(/\D/g,""),
            expiresAt,
            raw:parsed
          };
        }catch(_){}
      }
    }
    return null;
  }

  function clearStoredSession(){
    for(const key of CFG.sessionKeys){
      try{sessionStorage.removeItem(key)}catch(_){}
      try{localStorage.removeItem(key)}catch(_){}
    }
  }

  function getClient(){
    if(client) return client;
    if(!window.supabase?.createClient) throw new Error("supabase_absent");
    if(!CFG.url || !CFG.key) throw new Error("supabase_config_absente");
    client = window.supabase.createClient(CFG.url, CFG.key, {
      auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
    });
    return client;
  }

  function sessionError(code){
    const e = new Error(code || "invalid_or_expired_session");
    e.code = code || "invalid_or_expired_session";
    return e;
  }

  function responseCode(data){
    return String(data?.reason || data?.error || "").trim();
  }

  function assertServerOk(data){
    if(data?.ok === false){
      const code = responseCode(data) || "operation_refusee";
      if(code === "invalid_or_expired_session") throw sessionError(code);
      const e = new Error(code);
      e.code = code;
      throw e;
    }
    return data;
  }

  async function rpc(name, args){
    const sb = getClient();
    const {data,error} = await sb.rpc(name,args);
    if(error) throw error;
    return assertServerOk(data);
  }

  function requireSession(){
    const session = readStoredSession();
    if(session) return session;
    clearStoredSession();
    location.replace(CFG.pin);
    return null;
  }

  function token(){
    return readStoredSession()?.token || "";
  }

  async function getCockpit(){
    const t = token();
    if(!t) throw sessionError();
    return rpc("driver_session_get_cockpit",{p_token:t});
  }

  async function saveProfile(payload){
    const t = token();
    if(!t) throw sessionError();
    return rpc("driver_session_save_profile",{p_token:t,...payload});
  }

  async function listRates(){
    const t = token();
    if(!t) throw sessionError();
    return rpc("driver_session_list_rates",{p_token:t});
  }

  function ratesFrom(data){
    if(Array.isArray(data)) return data;
    if(Array.isArray(data?.rates)) return data.rates;
    if(Array.isArray(data?.items)) return data.items;
    if(Array.isArray(data?.data)) return data.data;
    return [];
  }

  async function upsertRate(routeLabel,priceFcfa){
    const t = token();
    if(!t) throw sessionError();
    return rpc("driver_session_upsert_rate",{
      p_token:t,
      p_route_label:String(routeLabel || "").trim().replace(/\s+/g," "),
      p_price_fcfa:Number(priceFcfa || 0)
    });
  }

  async function disableRate(rateId){
    const t = token();
    if(!t) throw sessionError();
    return rpc("driver_session_disable_rate",{p_token:t,p_rate_id:rateId});
  }

  function profilePayload(profile, overrides){
    const p = profile || {};
    return {
      p_business_name:p.business_name || p.driver_name || "",
      p_driver_name:p.driver_name || p.business_name || "",
      p_city:p.city || "",
      p_zones:p.zones || "",
      p_address:p.address || "",
      p_whatsapp:p.whatsapp || "",
      p_vehicle_type:p.vehicle_type || "",
      p_vehicle_label:p.vehicle_label || "",
      p_vehicle_plate:p.vehicle_plate || "",
      p_photo_url:p.photo_url || "",
      p_cover_url:p.cover_url || "",
      p_description:p.description || "",
      p_priority:Number(p.priority || 100),
      p_is_published:!!p.is_published,
      p_is_active:p.is_active !== false,
      ...(overrides || {})
    };
  }

  async function logout(){
    const t = token();
    try{
      if(t) await rpc("driver_revoke_session",{p_token:t});
    }catch(_){}
    clearStoredSession();
    location.replace(CFG.pin);
  }

  function handleError(error, messageEl){
    console.error(error);
    const code = String(error?.code || error?.message || "");
    if(code.includes("invalid_or_expired_session")){
      clearStoredSession();
      if(messageEl){
        messageEl.textContent = "❌ Session expirée. Retour à la porte PIN…";
        messageEl.className = "message bad";
      }
      setTimeout(() => location.replace(CFG.pin), 700);
      return true;
    }
    if(messageEl){
      messageEl.textContent = "❌ Erreur : " + (error?.message || "opération impossible");
      messageEl.className = "message bad";
    }
    return false;
  }

  function formatFcfa(value){
    return Number(value || 0).toLocaleString("fr-FR") + " FCFA";
  }

  window.DIGIY_DRIVER_SECURE = {
    readStoredSession,
    clearStoredSession,
    requireSession,
    getCockpit,
    saveProfile,
    listRates,
    ratesFrom,
    upsertRate,
    disableRate,
    profilePayload,
    logout,
    handleError,
    formatFcfa
  };
})();
