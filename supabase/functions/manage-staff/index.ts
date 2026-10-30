import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // Authenticate the caller ourselves and require an active admin.
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "unauthorized" }, 401);
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);
  const { data: prof } = await admin.from("profiles").select("role,is_active").eq("user_id", userData.user.id).maybeSingle();
  if (!prof || prof.role !== "admin" || !prof.is_active) return json({ error: "forbidden" }, 403);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }

  if (body.action === "create") {
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const displayName = String(body.display_name ?? "").trim().slice(0, 60);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "invalid_email" }, 400);
    if (password.length < 12) return json({ error: "weak_password" }, 400);
    // The DB trigger rejects any sign-up whose email isn't on this short-lived allowlist.
    const { error: allowErr } = await admin.from("signup_allowlist").upsert({ email, created_at: new Date().toISOString() });
    if (allowErr) return json({ error: allowErr.message }, 500);
    const { data, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { display_name: displayName || email.split("@")[0] },
    });
    if (error) {
      await admin.from("signup_allowlist").delete().eq("email", email);
      return json({ error: error.message }, 400);
    }
    // New accounts start as active staff (admin explicitly created them).
    await admin.from("profiles").update({ is_active: true, role: "staff" }).eq("user_id", data.user.id);
    return json({ ok: true, user_id: data.user.id });
  }

  if (body.action === "set_password") {
    const userId = String(body.user_id ?? "");
    const password = String(body.password ?? "");
    if (password.length < 12) return json({ error: "weak_password" }, 400);
    const { error } = await admin.auth.admin.updateUserById(userId, { password });
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  if (body.action === "delete") {
    const userId = String(body.user_id ?? "");
    if (userId === userData.user.id) return json({ error: "cannot_delete_self" }, 400);
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true });
  }

  return json({ error: "unknown_action" }, 400);
});
