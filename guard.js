// DIGIY PRO DRIVER — garde strict PIN 8 h
// La vérification du PIN reste dans pin.html. Ce garde accepte uniquement
// une session DRIVER structurée, fraîche et non expirée.
(function(){
  "use strict";

  const MODULE="DRIVER";
  const TTL=8*60*60*1000;
  const CLOCK_SKEW=5*60*1000;
  const LOGIN=window.DIGIY_LOGIN_URL||"./pin.html";
  const SESSION_KEYS=[
    "digiy_driver_session",
    "digiy_driver_guard_session",
    "digiy_guard_driver_session",
    "DIGIY_DRIVER_PIN_SESSION",
    "DIGIY_SESSION_DRIVER"
  ];
  const LEGACY_KEYS=[
    "DIGIY_PIN_SESSION","DIGIY_ACCESS","DIGIY_SESSION",
    "digiy_guard_session","digiy_session"
  ];
  const PHONE_KEYS=[
    "digiy_driver_phone","digiy_driver_last_phone","DIGIY_DRIVER_HUB_PHONE",
    "digiy_phone","DIGIY_PHONE"
  ];
  const SENSITIVE_URL_KEYS=[
    "phone","tel","driver_phone","whatsapp","pin","pin4","code",
    "session","session_token","token","access","auth","unlocked","pin_ok"
  ];

  let currentSession=null;
  let sbClient=null;
  const state={
    module:MODULE,slug:"",phone:"",owner_id:null,
    access:false,access_ok:false,pin_session_ok:false,
    preview:true,ready_flag:false,error:null,
    verified_at:null,validated_at:null,expires_at:null
  };

  try{document.documentElement.style.visibility="hidden"}catch(_){}

  const now=()=>Date.now();
  const parse=raw=>{try{return JSON.parse(raw||"null")}catch(_){return null}};
  const toMs=value=>{
    if(value==null||value==="")return 0;
    if(typeof value==="number"&&Number.isFinite(value))return value<100000000000?value*1000:value;
    const text=String(value).trim();
    if(/^\d+$/.test(text)){const n=Number(text);return n<100000000000?n*1000:n}
    const parsed=Date.parse(text);return Number.isFinite(parsed)?parsed:0;
  };
  const normPhone=value=>{
    const digits=String(value||"").replace(/\D/g,"");
    if(digits.length===9)return "221"+digits;
    return digits;
  };
  const normSlug=value=>String(value||"").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/\s+/g,"-").replace(/[^a-z0-9-_]/g,"")
    .replace(/-+/g,"-").replace(/^[-_]+|[-_]+$/g,"");
  const accessTrue=obj=>!!(obj&&(obj.access===true||obj.access_ok===true||obj.pin_session_ok===true||obj.verified===true));
  const read=(storage,key)=>{try{return storage.getItem(key)||""}catch(_){return ""}};
  const write=(storage,key,value)=>{try{storage.setItem(key,value)}catch(_){}};
  const remove=(storage,key)=>{try{storage.removeItem(key)}catch(_){}};

  function cleanSensitiveUrl(){
    try{
      const url=new URL(location.href);let changed=false;
      SENSITIVE_URL_KEYS.forEach(key=>{if(url.searchParams.has(key)){url.searchParams.delete(key);changed=true}});
      const slug=normSlug(url.searchParams.get("slug")||url.searchParams.get("identifiant")||"");
      if(slug&&/\d{7,}/.test(slug)){
        url.searchParams.delete("slug");url.searchParams.delete("identifiant");changed=true;
      }
      if(changed)history.replaceState({},document.title,url.pathname+(url.searchParams.toString()?"?"+url.searchParams.toString():"")+url.hash);
    }catch(_){}
  }

  function validateSession(input){
    if(!input||typeof input!=="object")return null;
    const candidates=[input,input.session,input.state,input.data,input.payload].filter(v=>v&&typeof v==="object");
    for(const raw of candidates){
      const module=String(raw.module||raw.module_code||"").trim().toUpperCase();
      const phone=normPhone(raw.phone||raw.driver_phone||raw.user_phone||"");
      const slug=normSlug(raw.slug||raw.driver_slug||"");
      const validated=toMs(raw.validated_at||raw.verified_at||raw.validated_at_ms||0);
      const expires=toMs(raw.expires_at||raw.expiresAt||0);
      const time=now();
      if(module!==MODULE)continue;
      if(phone.length<9)continue;
      if(!accessTrue(raw))continue;
      if(!validated||!expires)continue;
      if(validated>time+CLOCK_SKEW)continue;
      if(time-validated>TTL)continue;
      if(expires<=time)continue;
      if(expires>validated+TTL+CLOCK_SKEW)continue;
      return {
        module:MODULE,slug,phone,owner_id:raw.owner_id||null,
        access:true,access_ok:true,pin_session_ok:true,verified:true,
        verified_at:validated,validated_at:validated,expires_at:expires,
        source:String(raw.source||"pin.html")
      };
    }
    return null;
  }

  function storedSession(){
    for(const key of SESSION_KEYS){
      const fromSession=validateSession(parse(read(sessionStorage,key)));
      if(fromSession)return fromSession;
      const fromLocal=validateSession(parse(read(localStorage,key)));
      if(fromLocal)return fromLocal;
    }
    return null;
  }

  function saveSession(session){
    const clean=validateSession(session);if(!clean)return null;
    const raw=JSON.stringify(clean);
    SESSION_KEYS.forEach(key=>{write(sessionStorage,key,raw);write(localStorage,key,raw)});
    if(clean.slug){
      write(sessionStorage,"digiy_driver_slug",clean.slug);
      write(localStorage,"digiy_driver_slug",clean.slug);
      write(localStorage,"digiy_driver_last_slug",clean.slug);
    }
    write(sessionStorage,"digiy_driver_phone",clean.phone);
    write(sessionStorage,"DIGIY_DRIVER_HUB_PHONE",clean.phone);
    remove(localStorage,"digiy_driver_phone");
    remove(localStorage,"digiy_driver_last_phone");
    remove(localStorage,"DIGIY_DRIVER_HUB_PHONE");
    remove(localStorage,"digiy_phone");
    remove(sessionStorage,"digiy_phone");
    currentSession=clean;
    Object.assign(state,{
      module:MODULE,slug:clean.slug,phone:clean.phone,owner_id:clean.owner_id,
      access:true,access_ok:true,pin_session_ok:true,preview:false,ready_flag:true,error:null,
      verified_at:clean.verified_at,validated_at:clean.validated_at,expires_at:clean.expires_at
    });
    window.DIGIY_DRIVER_SESSION=clean;
    window.DIGIY_ACCESS={module:MODULE,phone:clean.phone,slug:clean.slug,access:true,access_ok:true,validated_at:clean.validated_at,expires_at:clean.expires_at};
    return clean;
  }

  function clearSession(){
    currentSession=null;
    [...SESSION_KEYS,...LEGACY_KEYS].forEach(key=>{remove(sessionStorage,key);remove(localStorage,key)});
    PHONE_KEYS.forEach(key=>{remove(sessionStorage,key);remove(localStorage,key)});
    try{delete window.DIGIY_DRIVER_SESSION;delete window.DIGIY_ACCESS}catch(_){}
    Object.assign(state,{
      slug:"",phone:"",owner_id:null,access:false,access_ok:false,pin_session_ok:false,
      preview:true,ready_flag:true,error:"Session PIN absente ou expirée.",
      verified_at:null,validated_at:null,expires_at:null
    });
  }

  function showPage(){
    try{
      document.documentElement.style.visibility="visible";
      document.documentElement.style.opacity="1";
      if(document.body){document.body.style.visibility="visible";document.body.style.opacity="1"}
    }catch(_){}
  }

  function buildPinUrl(){
    try{
      const url=new URL(LOGIN,location.href);
      url.searchParams.set("return",location.pathname+location.hash);
      return url.toString();
    }catch(_){return "./pin.html"}
  }

  function goPin(){
    clearSession();cleanSensitiveUrl();
    try{location.replace(buildPinUrl())}catch(_){location.href="./pin.html"}
  }

  function boot(){
    cleanSensitiveUrl();
    const session=storedSession();
    if(!session){goPin();return {ok:false,session:null,source:"locked"}}
    const saved=saveSession(session);
    showPage();
    try{document.documentElement.dataset.digiyGuard="ready"}catch(_){}
    return {ok:true,session:saved,source:"pin_session"};
  }

  const bootPromise=Promise.resolve(boot());
  const ready=()=>bootPromise.then(result=>Object.assign({},state,{ok:result.ok,session:result.session}));
  async function requireSession(options={}){
    const result=await bootPromise;
    if(result.ok&&result.session)return result.session;
    if(options.redirect!==false)goPin();
    return null;
  }
  function getSession(){
    if(currentSession){const valid=validateSession(currentSession);if(valid)return valid}
    const session=storedSession();return session?saveSession(session):null;
  }
  function logout(){goPin()}

  function getSb(){
    if(sbClient)return sbClient;
    const url=window.DIGIY_SUPABASE_URL||"";
    const key=window.DIGIY_SUPABASE_ANON_KEY||window.DIGIY_SUPABASE_ANON||"";
    if(!url||!key||!window.supabase?.createClient)return null;
    sbClient=window.supabase.createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:"digiy-driver-strict-guard"}});
    window.sb=sbClient;
    return sbClient;
  }

  async function rpc(name,args){
    const sb=getSb();if(!sb)return {data:null,error:new Error("Connexion indisponible")};
    return sb.rpc(name,args||{});
  }
  const boolData=data=>{
    const raw=Array.isArray(data)?data[0]:data;
    if(raw===true||raw===1)return true;
    if(typeof raw==="string")return /^(t|true|1|yes|ok)$/i.test(raw.trim());
    return !!(raw&&typeof raw==="object"&&Object.values(raw).some(v=>v===true||v===1||v==="t"||v==="true"));
  };
  async function checkAccessFromAbos(phone){
    const p=normPhone(phone||getSession()?.phone||"");if(!p)return false;
    for(const args of [{p_phone:p,p_module:MODULE},{phone:p,module:MODULE}]){
      const {data,error}=await rpc("digiy_has_module_access_from_abos",args);if(!error&&boolData(data))return true;
    }
    return false;
  }
  async function checkAccessLegacy(phone){
    const p=normPhone(phone||getSession()?.phone||"");if(!p)return false;
    const {data,error}=await rpc("digiy_has_access",{p_phone:p,p_module:MODULE});
    return !error&&boolData(data);
  }
  async function checkAccess(phone){return (await checkAccessFromAbos(phone))||(await checkAccessLegacy(phone))}
  async function resolveSubByPhone(phone){
    const sb=getSb(),p=normPhone(phone);if(!sb||!p)return null;
    const {data,error}=await sb.from("digiy_subscriptions_public").select("phone,slug,module").eq("phone",p).limit(1);
    if(error||!data?.[0])return null;return data[0];
  }
  async function resolveSubBySlug(slug){
    const sb=getSb(),s=normSlug(slug);if(!sb||!s)return null;
    const {data,error}=await sb.from("digiy_subscriptions_public").select("phone,slug,module").eq("slug",s).limit(1);
    if(error||!data?.[0])return null;return data[0];
  }

  function buildSafeUrl(path,params={}){
    const url=new URL(path||location.href,location.href);
    url.searchParams.delete("phone");url.searchParams.delete("tel");
    Object.entries(params).forEach(([key,value])=>{
      if(key==="phone"||key==="tel")return;
      const clean=String(value??"").trim();if(clean)url.searchParams.set(key,clean);else url.searchParams.delete(key);
    });
    return url.origin===location.origin?url.pathname+url.search+url.hash:url.toString();
  }
  const go=(target,mode)=>{const url=buildSafeUrl(target||location.href);mode==="replace"?location.replace(url):location.assign(url)};
  const buildPayUrl=()=>"https://digiy-carnet-pro.digiylyfe.com/pin.html";

  window.DIGIY_GUARD={
    VERSION:"driver-guard-strict-pin8h-20260716",module:MODULE,state,
    ready,requireSession,getSession,
    getSlug:()=>getSession()?.slug||"",
    getPhone:()=>getSession()?.phone||"",
    getOwnerId:()=>getSession()?.owner_id||null,
    getModule:()=>MODULE,
    isAuthenticated:()=>!!getSession(),
    clearSession,clearAll:clearSession,logout,
    buildPinUrl,goPin,buildPayUrl,goPay:()=>location.assign(buildPayUrl()),
    buildUrl:buildSafeUrl,go,cleanUrl:cleanSensitiveUrl,
    getSb,resolveSubBySlug,resolveSubByPhone,
    checkAccessFromAbos,checkAccessLegacy,checkAccess,
    rememberIdentity:()=>({slug:getSession()?.slug||"",phone:getSession()?.phone||""}),
    saveSession,
    loginWithPin:async()=>({ok:false,error:"Utilise la porte pin.html."})
  };

  console.info("[DIGIY DRIVER] verrou strict PIN 8 h actif");
})();