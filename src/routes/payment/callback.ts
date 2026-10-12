import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

function env(name: string) { const value = process.env[name]; if (!value) throw new Error(`Missing ${name}`); return value; }
function adminClient() { return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } }); }

export const Route = createFileRoute("/payment/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const txRef = url.searchParams.get("tx_ref") || "";
        const transactionId = Number(url.searchParams.get("transaction_id"));
        let state = "failed";
        let orderNumber = "";
        try {
          if (!txRef || !Number.isFinite(transactionId)) throw new Error("Missing payment reference");
          const supabase = adminClient();
          const { data: tx } = await supabase.from("payment_transactions").select("order_id,tx_ref,amount,currency").eq("tx_ref", txRef).single();
          if (!tx) throw new Error("Payment transaction not found");
          const verificationResponse = await fetch(`https://api.flutterwave.com/v3/transactions/${transactionId}/verify`, { headers: { Authorization: `Bearer ${env("FLW_SECRET_KEY")}`, "Content-Type": "application/json" } });
          const verification = await verificationResponse.json() as { status?: string; data?: Record<string, unknown>; message?: string };
          const data = verification.data || {};
          const valid = verification.status === "success" && String(data['status'] || "").toLowerCase() === "successful" && String(data['tx_ref'] || "") === tx.tx_ref && String(data['currency'] || "") === tx.currency && Number(data['amount']) >= Number(tx.amount);
          const finalStatus = valid ? "successful" : (String(data['status'] || "").toLowerCase() === "cancelled" ? "cancelled" : "failed");
          await supabase.rpc("apply_flutterwave_result", {
            p_order_id: tx.order_id, p_tx_ref: tx.tx_ref, p_transaction_id: transactionId,
            p_flw_ref: String(data['flw_ref'] || "") || null, p_status: finalStatus,
            p_provider_status: String(data['status'] || ""), p_provider_message: String(data['processor_response'] || verification.message || ""),
            p_raw_response: verification, p_webhook_payload: null,
          });
          const { data: order } = await supabase.from("orders").select("order_number").eq("id", tx.order_id).single();
          orderNumber = order?.order_number ? String(order.order_number) : "";
          state = valid ? "success" : "failed";
        } catch (error) {
          console.error("Flutterwave callback failed", error);
        }
        const destination = new URL("/payment-result", url.origin);
        destination.searchParams.set("state", state);
        if (orderNumber) destination.searchParams.set("order", orderNumber);
        return Response.redirect(destination.toString(), 303);
      },
    },
  },
});

