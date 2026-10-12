import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, PackageSearch, RefreshCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/track")({
  head: () => ({
    meta: [
      { title: "Track your order — Nalu’s Kitchen" },
      { name: "description", content: "Track your Nalu’s Kitchen order by order number and phone number." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Track your order — Nalu’s Kitchen" },
      { property: "og:description", content: "See where your order is: Confirmed, Preparing, Ready or Delivered." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TrackPage,
});

type TrackedOrder = {
  order_number: number;
  customer_name: string;
  status: string;
  payment_status: string;
  fulfillment: string;
  items: Array<{ name: string; qty: number }> | null;
  total: number;
  created_at: string;
};

const steps = ["New", "Confirmed", "Preparing", "Ready", "Delivered"];

function TrackPage() {
  const [reference, setReference] = useState("");
  const [phone, setPhone] = useState("");
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function lookup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setOrder(null);
    const digits = reference.replace(/\D/g, "");
    if (!digits) {
      setError("Enter the order number from your confirmation, like NK1234.");
      setBusy(false);
      return;
    }
    const { data, error: rpcError } = await supabase.rpc("track_order", {
      p_order_number: Number(digits),
      p_phone: phone.trim(),
    });
    setBusy(false);
    if (rpcError) {
      setError("We couldn’t check that order right now. Please try again, or call us on +260 978 408 225.");
      return;
    }
    const found = Array.isArray(data) ? data[0] : (data as TrackedOrder | null);
    if (!found) {
      setError("No order found for that number and phone. Check both and try again.");
      return;
    }
    setOrder(found as unknown as TrackedOrder);
  }

  useEffect(() => {
    if (!order) return;
    let cancelled = false;
    const refresh = async () => {
      const { data } = await supabase.rpc("track_order", {
        p_order_number: order.order_number,
        p_phone: phone.trim(),
      });
      const found = Array.isArray(data) ? data[0] : data;
      if (!cancelled && found) setOrder(found as unknown as TrackedOrder);
    };
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [order?.order_number, phone]);

  const currentIndex = order ? steps.indexOf(order.status) : -1;

  return (
    <div className="min-h-screen bg-brand-ink px-5 py-12 text-brand-cream">
      <div className="mx-auto w-full max-w-lg">
        <Link to="/" className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-full border border-brand-gold/60 font-display text-lg text-brand-gold">N</span>
          <span className="font-display text-xl">Nalu’s Kitchen</span>
        </Link>

        <h1 className="mt-10 font-display text-4xl">Track your order</h1>
        <p className="mt-3 text-sm leading-6 text-brand-cream/70">
          Enter the order number we gave you (like NK1234) and the phone number you ordered with.
        </p>

        <form onSubmit={lookup} className="mt-7 space-y-4 rounded-md bg-background p-6 text-foreground">
          <label className="field-label">
            Order number
            <input value={reference} onChange={(event) => setReference(event.target.value)} required placeholder="NK1234" className="field" />
          </label>
          <label className="field-label">
            Phone number you ordered with
            <input value={phone} onChange={(event) => setPhone(event.target.value)} required type="tel" placeholder="+260 …" className="field" />
          </label>
          <button type="submit" disabled={busy} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-sm bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            <PackageSearch size={17} /> {busy ? "Checking…" : "Find my order"}
          </button>
          {error && <p className="rounded-sm bg-muted p-3 text-sm">{error}</p>}
        </form>

        {order && (
          <div className="mt-6 rounded-md bg-background p-6 text-foreground">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Order #{`NK${order.order_number}`}</p>
                <h2 className="mt-1 font-display text-2xl">Hi {order.customer_name.split(" ")[0]}</h2>
              </div>
              <button
                onClick={() => {
                  setOrder(null);
                  setTimeout(() => document.querySelector<HTMLInputElement>("input[name=\"reference\"]")?.focus(), 0);
                }}
                className="flex items-center gap-1 text-sm text-primary underline"
              >
                <RefreshCcw size={14} /> Check again
              </button>
            </div>

            {order.status === "Cancelled" ? (
              <p className="mt-5 rounded-sm bg-muted p-4 text-sm">This order was cancelled. Please call us on +260 978 408 225 if that doesn’t seem right.</p>
            ) : (
              <ol className="mt-6 space-y-3">
                {steps.map((step, index) => {
                  const done = index <= currentIndex;
                  return (
                    <li key={step} className={`flex items-center gap-3 text-sm ${done ? "font-semibold" : "text-muted-foreground"}`}>
                      <span className={`grid size-7 place-items-center rounded-full border ${done ? "border-brand-green bg-brand-green text-white" : "border-border"}`}>
                        {done ? <Check size={15} /> : <span className="text-xs">{index + 1}</span>}
                      </span>
                      {step}{index === currentIndex ? " — we’re here" : ""}
                    </li>
                  );
                })}
              </ol>
            )}

            <div className="mt-6 border-t border-border pt-4 text-sm text-muted-foreground">
              {order.fulfillment} · Payment: {order.payment_status}
              <ul className="mt-2">
                {(order.items ?? []).map((line, index) => (
                  <li key={index}>{line.qty} × {line.name}</li>
                ))}
              </ul>
              <p className="mt-2 font-semibold text-foreground">Total K{Number(order.total).toLocaleString("en-ZM")}</p>
            </div>
          </div>
        )}

        <p className="mt-8 text-center text-xs text-brand-cream/50">
          Questions about your order? Call <a href="tel:+260978408225" className="underline">+260 978 408 225</a> · Daily 08:00–20:00
        </p>
      </div>
    </div>
  );
}
