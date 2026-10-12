import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function adminClient() {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
}

function origin(request: Request) {
  return new URL(request.url).origin;
}

export const Route = createFileRoute("/api/payments/initiate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json() as { orderId?: string; email?: string };
          if (!body.orderId || !body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) return json({ error: "A valid email is required for online payment." }, 400);

          const supabase = adminClient();
          const { data: order, error: orderError } = await supabase.from("orders").select("id,order_number,total,customer_name,phone,customer_email,payment_method,payment_status").eq("id", body.orderId).single();
          if (orderError || !order) return json({ error: "Order not found." }, 404);
          if (order.payment_method !== "Flutterwave") return json({ error: "This order is not configured for Flutterwave." }, 400);
          if (order.payment_status === "Verified") return json({ error: "This order is already paid." }, 409);

          const { data: existingPayment } = await supabase.from("payment_transactions").select("tx_ref,checkout_url,status").eq("order_id", order.id).in("status", ["initiated", "pending"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
          if (existingPayment?.checkout_url) return json({ checkoutUrl: existingPayment.checkout_url, txRef: existingPayment.tx_ref, orderNumber: order.order_number });

          const txRef = `NALU-${order.order_number}-${crypto.randomUUID().replaceAll("-", "").slice(0, 18).toUpperCase()}`;
          const callback = `${origin(request)}/payment/callback`;
          const payload = {
            tx_ref: txRef,
            amount: Number(order.total),
            currency: "ZMW",
            country: "ZM",
            redirect_url: callback,
            payment_options: "card, mobilemoneyzambia",
            customer: {
              email: body.email,
              name: order.customer_name,
              phonenumber: order.phone,
            },
            customizations: {
              title: "Nalu’s Kitchen",
              description: `Order NK${order.order_number}`,
            },
            meta: { order_id: order.id, order_number: order.order_number },
          };

          const response = await fetch("https://api.flutterwave.com/v3/payments", {
            method: "POST",
            headers: { Authorization: `Bearer ${env("FLW_SECRET_KEY")}`, "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const result = await response.json() as { status?: string; message?: string; data?: { link?: string } };
          if (!response.ok || result.status !== "success" || !result.data?.link) return json({ error: result.message || "Flutterwave could not start the payment." }, 502);

          const { error: txError } = await supabase.from("payment_transactions").insert({
            order_id: order.id,
            order_number: order.order_number,
            tx_ref: txRef,
            amount: Number(order.total),
            currency: "ZMW",
            payment_method: "flutterwave",
            status: "initiated",
            checkout_url: result.data.link,
            raw_response: result,
          });
          if (txError) return json({ error: "Payment was created but could not be recorded. Contact support before retrying." }, 500);

          await supabase.from("orders").update({ customer_email: body.email, payment_reference: txRef, payment_status: "Awaiting verification" }).eq("id", order.id);
          return json({ checkoutUrl: result.data.link, txRef, orderNumber: order.order_number });
        } catch (error) {
          console.error("Flutterwave initiation failed", error);
          return json({ error: "Payment service is temporarily unavailable." }, 500);
        }
      },
    },
  },
});
