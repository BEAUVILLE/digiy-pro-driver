import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceKey) {
    return new Response(
      JSON.stringify({ ok: false, error: "Missing environment variables" }),
      { status: 500 }
    );
  }

  const supabase = createClient(url, serviceKey);

  const { error } = await supabase.rpc("expire_driver_subscriptions");

  if (error) {
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { status: 500 }
    );
  }

  return new Response(
    JSON.stringify({ ok: true, message: "Subscriptions expired" }),
    { status: 200 }
  );
});
