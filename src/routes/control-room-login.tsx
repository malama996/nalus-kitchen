import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/control-room-login")({
  head: () => ({
    meta: [
      { title: "Control room sign in — Nalu’s Kitchen" },
      { name: "description", content: "Private sign-in for Nalu’s Kitchen management staff." },
      { property: "og:title", content: "Control room sign in — Nalu’s Kitchen" },
      { property: "og:description", content: "Private area for the Nalu’s Kitchen team." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    setBusy(true);
    setNotice("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { setNotice(error.message); return; }
    void navigate({ to: "/control-room" });
  }

  return (
    <main className="grid min-h-screen place-items-center bg-brand-ink px-5 py-16 text-brand-cream">
      <div className="w-full max-w-sm">
        <p className="eyebrow text-brand-gold">Nalu’s Kitchen</p>
        <h1 className="font-display text-4xl">Team sign in</h1>
        <p className="mt-3 text-sm text-brand-cream/60">This area is not linked from the customer website. Access is enforced by Supabase Auth and database roles.</p>
        <form onSubmit={submit} className="mt-8 space-y-4 rounded-md bg-background p-6 text-foreground">
          <label className="field-label">Email<input name="email" type="email" required className="field" /></label>
          <label className="field-label">Password<input name="password" type="password" minLength={6} required className="field" /></label>
          <button type="submit" disabled={busy} className="min-h-11 w-full rounded-sm bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {busy ? "Please wait…" : "Sign in"}
          </button>
          {notice && <p className="rounded-sm bg-muted p-3 text-sm">{notice}</p>}
        </form>
        <a href="/" className="mt-6 block text-center text-sm text-brand-cream/60 underline">Back to the website</a>
      </div>
    </main>
  );
}
