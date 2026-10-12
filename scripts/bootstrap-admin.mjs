import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

if (!url || !serviceKey || !email || !password) {
  console.error("Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL and ADMIN_PASSWORD first.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (error) {
  console.error(error.message);
  process.exit(1);
}

const { error: roleError } = await admin.from("user_roles").insert({ user_id: data.user.id, role: "admin" });
if (roleError) {
  console.error(roleError.message);
  process.exit(1);
}

console.log(`Admin created: ${email}`);
console.log(`User id: ${data.user.id}`);
