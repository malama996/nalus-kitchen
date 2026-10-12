import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/payment-result")({
  head: () => ({ meta: [{ title: "Payment result — Nalu’s Kitchen" }, { name: "robots", content: "noindex" }] }),
  component: PaymentResultPage,
});

function PaymentResultPage() {
  const search = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
  const state = search.get("state");
  const order = search.get("order");
  const success = state === "success";
  return <main className="grid min-h-screen place-items-center bg-brand-ink px-5 py-16 text-brand-cream"><div className="w-full max-w-md rounded-md bg-background p-8 text-center text-foreground shadow-2xl">
    {success ? <CheckCircle2 className="mx-auto text-brand-green" size={56}/> : <XCircle className="mx-auto text-destructive" size={56}/>} 
    <p className="eyebrow mt-6">Flutterwave payment</p>
    <h1 className="mt-2 font-display text-4xl">{success ? "Payment confirmed" : "Payment not confirmed"}</h1>
    <p className="mt-4 text-sm leading-6 text-muted-foreground">{success ? `Your payment for order ${order ? `NK${order}` : ""} was verified. The kitchen can now start processing the order.` : "We could not confirm the payment. Do not pay again immediately if you were debited; contact Nalu’s Kitchen so the transaction can be checked."}</p>
    <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center"><Link to="/track" className="inline-flex min-h-11 items-center justify-center rounded-sm bg-primary px-5 text-sm font-semibold text-primary-foreground">Track order</Link><Link to="/" className="inline-flex min-h-11 items-center justify-center rounded-sm border border-border px-5 text-sm font-semibold">Back to menu</Link></div>
  </div></main>;
}
