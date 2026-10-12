import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}
function adminClient() {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
}

async function verify(transactionId: number) {
  const response = await fetch(`https://api.flutterwave.com/v3/transactions/${transactionId}/verify`, {
    headers: { Authorization: `Bearer ${env("FLW_SECRET_KEY")}`, "Content-Type": "application/json" },
  });
  const body = await response.json() as { status?: string; data?: Record<string, unknown>; message?: string };
  if (!response.ok) throw new Error(body.message || "Verification failed");
  return body;
}

export const Route = createFileRoute("/api/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const secret = env("FLW_WEBHOOK_SECRET_HASH");
          const signature = request.headers.get("verif-hash") || request.headers.get("flutterwave-signature");
          if (!signature || signature !== secret) return new Response("Unauthorized", { status: 401 });

          const payload = await request.json() as { event?: string; data?: Record<string, unknown> };
          const transactionId = Number(payload.data?.['id']);
          const txRef = String(payload.data?.['tx_ref'] || "");
          if (!Number.isFinite(transactionId) || !txRef) return new Response("OK", { status: 200 });

          const supabase = adminClient();
          const { data: tx } = await supabase.from("payment_transactions").select("id,order_id,tx_ref,amount,currency,status").eq("tx_ref", txRef).single();
          if (!tx) return new Response("OK", { status: 200 });

          const verified = await verify(transactionId);
          const data = verified.data || {};
          const status = String(data['status'] || "").toLowerCase();
          const amount = Number(data['amount']);
          const currency = String(data['currency'] || "");
          const verifiedRef = String(data['tx_ref'] || "");
          const valid = verified.status === "success" && status === "successful" && verifiedRef === tx.tx_ref && currency === tx.currency && amount >= Number(tx.amount);

          const finalStatus = valid ? "successful" : (status === "cancelled" ? "cancelled" : status === "failed" ? "failed" : "verification_failed");
          await supabase.rpc("apply_flutterwave_result", {
            p_order_id: tx.order_id,
            p_tx_ref: tx.tx_ref,
            p_transaction_id: transactionId,
            p_flw_ref: String(data['flw_ref'] || "") || null,
            p_status: finalStatus,
            p_provider_status: status,
            p_provider_message: String(data['processor_response'] || verified.message || ""),
            p_raw_response: verified,
            p_webhook_payload: payload,
          });
          return new Response("OK", { status: 200 });
        } catch (error) {
          console.error("Flutterwave webhook failed", error);
          return new Response("Webhook processing failed", { status: 500 });
        }
      },
    },
  },
});

