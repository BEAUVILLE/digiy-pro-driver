import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "authorization, x-cron-secret, content-type",
    },
  });
}

serve(async (req) => {
  // ✅ Preflight CORS
  if (req.method === "OPTIONS") return json({ ok: true }, 200);

  // ✅ GET/POST only
  if (req.method !== "GET" && req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  // ✅ Env
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  // ✅ Secret anti-abus (à poser dans Supabase > Edge Functions > Secrets)
  const CRON_SECRET = Deno.env.get("CRON_SECRET");

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return json({ ok: false, error: "Missing SUPABASE_URL or SERVICE_ROLE key" }, 500);
  }

  // ✅ Protection: secret obligatoire si défini
  if (CRON_SECRET) {
    const got =
      req.headers.get("x-cron-secret") ||
      (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");

    if (!got || got !== CRON_SECRET) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }
  }

  // ✅ Supabase admin client
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // ✅ Paramètres optionnels
  const u = new URL(req.url);
  const module = (u.searchParams.get("module") || "DRIVER").toUpperCase(); // ex: DRIVER

  // Si tu veux un payload POST plus tard
  // let body: any = null;
  // if (req.method === "POST") {
  //   try { body = await req.json(); } catch (_) {}
  // }

  const startedAt = Date.now();

  // ✅ RPC (tu peux adapter pour accepter p_module si ta fonction le supporte)
  // Option A: fonction globale expire_driver_subscriptions()
  const { data, error } = await supabase.rpc("expire_driver_subscriptions");

  if (error) {
    return json(
      { ok: false, module, error: error.message, took_ms: Date.now() - startedAt },
      500
    );
  }

  return json(
    {
      ok: true,
      module,
      message: "Subscriptions expired",
      result: data ?? null,
      took_ms: Date.now() - startedAt,
    },
    200
  );
});
