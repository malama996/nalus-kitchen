import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, ChevronLeft, MapPin, Menu, Minus, Phone, Plus, ShoppingBag, X, PackageSearch } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { signMenuPhotos } from "@/lib/menu-photos";
import heroImage from "@/assets/nalu-hero.jpg";
import nshimaChicken from "@/assets/nshima-chicken.jpg";
import kapentaPlate from "@/assets/kapenta-plate.jpg";
import chickenBurger from "@/assets/chicken-burger.jpg";
import sundayPlatter from "@/assets/sunday-platter.jpg";
import nshimaBeef from "@/assets/nshima-beef.jpg";
import ifisashi from "@/assets/ifisashi.jpg";
import chikanda from "@/assets/chikanda.jpg";
import beefBurger from "@/assets/beef-burger.jpg";
import chickenChips from "@/assets/chicken-chips.jpg";
import chips from "@/assets/chips.jpg";
import coleslaw from "@/assets/coleslaw.jpg";
import softDrink from "@/assets/soft-drink.jpg";
import freshJuice from "@/assets/fresh-juice.jpg";

type MenuItem = { id: string; name: string; category: string; price: number; description: string; popular: boolean; image_key: string | null };
type Cart = Record<string, number>;
type Stage = "cart" | "checkout" | "success";

export const bundledImages: Record<string, string> = {
  "nshima-chicken": nshimaChicken,
  "kapenta-plate": kapentaPlate,
  "chicken-burger": chickenBurger,
  "sunday-platter": sundayPlatter,
  "nshima-beef": nshimaBeef,
  ifisashi,
  chikanda,
  "beef-burger": beefBurger,
  "chicken-chips": chickenChips,
  chips,
  coleslaw,
  "soft-drink": softDrink,
  "fresh-juice": freshJuice,
};
const categories = ["Traditional Meals", "Fast Foods", "Sides", "Drinks", "Specials"];
const packages = [
  { name: "Traditional", text: "Nshima, chicken, beef, kapenta and traditional vegetables." },
  { name: "Standard", text: "A main meal, two sides and a drink." },
  { name: "Premium", text: "Starter, main course, sides, dessert and drinks." },
];
const navigation: Array<[string, string]> = [
  ["menu-section", "Menu"],
  ["catering", "Catering"],
  ["story", "Our story"],
  ["contact", "Contact"],
];

const money = (value: number) => `K${value.toLocaleString("en-ZM", { maximumFractionDigits: 0 })}`;

function BrandMark() {
  return <span className="grid size-9 place-items-center rounded-full border border-brand-gold/60 font-display text-lg text-brand-gold">N</span>;
}

function AppButton({ children, className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-sm px-5 py-2.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`} {...props}>{children}</button>;
}

export function NalusKitchen() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [category, setCategory] = useState(categories[0]);
  const [cart, setCart] = useState<Cart>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("cart");
  const [notice, setNotice] = useState("");
  const [bookingStage, setBookingStage] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [orderRef, setOrderRef] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploadedPhotos, setUploadedPhotos] = useState<Record<string, string>>({});
  const [mobileMoneyNumber, setMobileMoneyNumber] = useState("+260 978 408 225");
  const [paymentBusy, setPaymentBusy] = useState(false);

  const photoFor = (key: string | null) => (key ? bundledImages[key] ?? uploadedPhotos[key] ?? null : null);

  const loadMenu = async () => {
    const { data } = await supabase.from("menu_items").select("id,name,category,price,description,popular,image_key").eq("available", true).order("sort_order");
    if (data) {
      setMenuItems(data.map((item) => ({ ...item, price: Number(item.price) })));
      setUploadedPhotos(await signMenuPhotos(data.map((item) => item.image_key)));
    }
    const { data: settings } = await supabase.from("business_settings").select("key,value").in("key", ["mobile_money_number"]);
    const mobileMoney = settings?.find((row) => row.key === "mobile_money_number")?.value;
    if (mobileMoney) setMobileMoneyNumber(mobileMoney);
    setLoading(false);
  };

  useEffect(() => {
    void loadMenu();
    const channel = supabase.channel("public-menu").on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, loadMenu).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);

  const lines = useMemo(() => Object.entries(cart).flatMap(([id, quantity]) => {
    const item = menuItems.find((entry) => entry.id === id);
    return item ? [{ ...item, quantity }] : [];
  }), [cart, menuItems]);
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  const total = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);

  const adjust = (id: string, delta: number) => setCart((current) => {
    const next = Math.min(20, (current[id] ?? 0) + delta);
    const updated = { ...current };
    if (next <= 0) delete updated[id]; else updated[id] = next;
    return updated;
  });
  const goTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMobileOpen(false);
  };
  const openCart = () => { setStage("cart"); setCartOpen(true); };

  async function submitOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fulfillment = String(form.get("fulfillment"));
    const paymentMethod = String(form.get("paymentMethod"));
    const email = String(form.get("email") || "").trim();
    if (paymentMethod === "Flutterwave" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setNotice("Enter a valid email address to continue with Flutterwave.");
      return;
    }
    setPaymentBusy(paymentMethod === "Flutterwave");
    const { data, error } = await supabase.rpc("place_order", {
      p_customer_name: String(form.get("name")),
      p_phone: String(form.get("phone")),
      p_customer_email: email || null,
      p_fulfillment: fulfillment,
      p_address: fulfillment === "Delivery" ? String(form.get("address") || "") : null,
      p_notes: String(form.get("notes") || "") || null,
      p_payment_method: paymentMethod,
      p_payment_reference: null,
      p_items: lines.map(({ id, quantity }) => ({ id, qty: quantity })),
    });
    if (error || !data?.[0]) { setPaymentBusy(false); setNotice("We couldn’t place that order. Please call us and we’ll help right away."); return; }
    const order = data[0] as { order_id: string; order_number: number };
    if (paymentMethod === "Flutterwave") {
      const response = await fetch("/api/payments/initiate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: order.order_id, email }) });
      const payment = await response.json() as { checkoutUrl?: string; error?: string };
      if (!response.ok || !payment.checkoutUrl) {
        setPaymentBusy(false);
        setNotice(payment.error || "We couldn’t start the payment. Your order is saved; please contact us before retrying.");
        return;
      }
      window.location.assign(payment.checkoutUrl);
      return;
    }
    setPaymentBusy(false);
    setOrderRef(`NK${order.order_number}`); setCart({}); setStage("success"); setNotice("");
  }

  async function submitBooking(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const formElement = event.currentTarget;
    setBookingStage("sending");
    const { error } = await supabase.rpc("create_booking", {
      p_event_type: String(form.get("eventType")), p_package_name: String(form.get("package")), p_event_date: String(form.get("date")),
      p_event_time: String(form.get("time") || "") || null, p_venue: String(form.get("venue")), p_guests: Number(form.get("guests")),
      p_notes: String(form.get("notes") || "") || null, p_customer_name: String(form.get("name")), p_phone: String(form.get("phone")), p_email: String(form.get("email") || "") || null,
    });
    if (error) { setBookingStage("error"); return; }
    formElement.reset();
    setBookingStage("done");
  }

  return <div className="min-h-screen bg-background text-foreground">
    <header className="fixed inset-x-0 top-0 z-40 border-b border-brand-cream/15 bg-brand-ink/95 text-brand-cream backdrop-blur">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 lg:px-8">
        <button onClick={() => goTo("home")} className="flex items-center gap-3" aria-label="Nalu's Kitchen home"><BrandMark/><span className="font-display text-xl">Nalu’s Kitchen</span></button>
        <nav className="hidden items-center gap-7 md:flex">
          {navigation.map(([id,label]) => <button key={id} onClick={() => goTo(id)} className="text-sm text-brand-cream/75 transition hover:text-brand-gold">{label}</button>)}
        </nav>
        <div className="flex items-center gap-2">
          <a href="/track" className="hidden min-h-11 items-center gap-2 rounded-sm border border-brand-cream/30 px-4 text-sm font-semibold text-brand-cream hover:border-brand-gold hover:text-brand-gold sm:inline-flex"><PackageSearch size={17}/> Track order</a><AppButton onClick={openCart} className="bg-primary text-primary-foreground hover:bg-primary/90"><ShoppingBag size={17}/> Order <span className="grid size-5 place-items-center rounded-full bg-brand-gold text-xs text-brand-ink">{count}</span></AppButton>
          <button className="grid size-11 place-items-center md:hidden" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Open navigation">{mobileOpen ? <X/> : <Menu/>}</button>
        </div>
      </div>
      {mobileOpen && <nav className="border-t border-brand-cream/15 px-5 py-4 md:hidden">{navigation.map(([id,label]) => <button key={id} onClick={() => goTo(id)} className="block w-full py-3 text-left">{label}</button>)}<a href="/track" className="block w-full py-3 text-left">Track order</a></nav>}
    </header>

    <main>
      <section id="home" className="relative flex min-h-[92svh] items-end overflow-hidden pt-18">
        <img src={heroImage} width={1536} height={1024} alt="Nshima with village chicken and vegetables" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-hero-shade" />
        <div className="relative mx-auto w-full max-w-7xl px-5 pb-16 pt-40 lg:px-8 lg:pb-20">
          <p className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-brand-gold"><MapPin size={14}/> Solwezi · Pickup & delivery</p>
          <h1 className="max-w-3xl font-display text-5xl leading-[1.02] text-brand-cream sm:text-6xl lg:text-7xl">The food that brings us home.</h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-brand-cream/80 sm:text-lg">Traditional Zambian favourites, quick comfort food and memorable catering—cooked fresh every day.</p>
          <div className="mt-8 flex flex-wrap gap-3"><AppButton onClick={() => goTo("menu-section")} className="bg-primary text-primary-foreground hover:bg-primary/90">Explore the menu <ArrowRight size={17}/></AppButton><AppButton onClick={() => goTo("catering")} className="border border-brand-cream/45 text-brand-cream hover:bg-brand-cream/10">Plan an event</AppButton></div>
        </div>
      </section>

      <section className="border-y border-border bg-brand-ink text-brand-cream"><div className="mx-auto grid max-w-7xl grid-cols-1 divide-y divide-brand-cream/15 px-5 md:grid-cols-3 md:divide-x md:divide-y-0 lg:px-8">{[["01","Made the Zambian way","Real ingredients and familiar flavours."],["02","Fresh to order","Your plate starts when your order does."],["03","Gatherings made easy","From office lunch to wedding feast."]].map(([n,t,d]) => <div key={n} className="flex gap-5 py-7 md:px-7 md:first:pl-0"><span className="font-display text-brand-gold">{n}</span><div><h2 className="font-semibold">{t}</h2><p className="mt-1 text-sm text-brand-cream/60">{d}</p></div></div>)}</div></section>

      <section id="menu-section" className="scroll-mt-20 py-20 lg:py-28"><div className="mx-auto max-w-7xl px-5 lg:px-8">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="eyebrow">Cooked today</p><h2 className="section-title">Choose your favourite</h2></div><p className="max-w-md text-muted-foreground">Every meal is prepared fresh. Prices are in Zambian Kwacha.</p></div>
        <div className="mt-9 flex gap-2 overflow-x-auto pb-2">{categories.map((item) => <button key={item} onClick={() => setCategory(item)} className={`shrink-0 rounded-full border px-4 py-2 text-sm transition ${category === item ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary"}`}>{item}</button>)}</div>
        {loading ? <p className="py-16 text-muted-foreground">Bringing out today’s menu…</p> : <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{menuItems.filter((item) => item.category === category).map((item) => <article key={item.id} className="group overflow-hidden rounded-md border border-border bg-card"><div className="aspect-[4/3] overflow-hidden bg-muted">{photoFor(item.image_key) ? <img src={photoFor(item.image_key)!} width={1024} height={1024} loading="lazy" alt={item.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"/> : <div className="grid h-full place-items-center font-display text-5xl text-primary/30">N</div>}</div><div className="p-5"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><h3 className="font-display text-xl">{item.name}</h3>{item.popular && <span className="rounded-full bg-brand-gold/20 px-2 py-1 text-[10px] font-bold uppercase text-brand-clay">Popular</span>}</div><p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p></div><span className="font-semibold">{money(item.price)}</span></div><div className="mt-5 flex items-center justify-between"><span className="text-xs text-muted-foreground">Freshly prepared</span><div className="flex h-10 items-center rounded-sm border border-border"><button onClick={() => adjust(item.id,-1)} className="grid size-10 place-items-center" aria-label={`Remove ${item.name}`}><Minus size={15}/></button><span className="w-6 text-center text-sm font-semibold">{cart[item.id] ?? 0}</span><button onClick={() => adjust(item.id,1)} className="grid size-10 place-items-center bg-primary text-primary-foreground" aria-label={`Add ${item.name}`}><Plus size={15}/></button></div></div></div></article>)}</div>}
      </div></section>

      <section id="catering" className="scroll-mt-18 bg-brand-green py-20 text-brand-cream lg:py-28"><div className="mx-auto grid max-w-7xl gap-14 px-5 lg:grid-cols-[.8fr_1.2fr] lg:px-8">
        <div><p className="eyebrow text-brand-gold">Catering & celebrations</p><h2 className="section-title text-brand-cream">Good food for your biggest days.</h2><p className="mt-5 max-w-lg text-brand-cream/70">Weddings, kitchen parties, conferences, birthdays, funerals and intimate gatherings—tell us what you need.</p><div className="mt-8 divide-y divide-brand-cream/15 border-y border-brand-cream/15">{packages.map((pack) => <div key={pack.name} className="py-5"><h3 className="font-display text-xl">{pack.name}</h3><p className="mt-1 text-sm text-brand-cream/60">{pack.text}</p></div>)}</div></div>
        {bookingStage === "done" ? (
          <div className="rounded-md bg-background p-8 text-foreground sm:col-span-2">
            <div className="grid size-12 place-items-center rounded-full bg-brand-green text-brand-cream"><Check size={24}/></div>
            <h3 className="mt-5 font-display text-2xl">Request received.</h3>
            <p className="mt-2 text-sm text-muted-foreground">Your catering request is in. We’ll call you to confirm the details.</p>
            <button type="button" onClick={() => setBookingStage("idle")} className="mt-6 inline-flex min-h-11 items-center rounded-sm border border-border px-5 py-2.5 text-sm font-semibold transition hover:bg-muted">Make another request</button>
          </div>
        ) : (
        <form onSubmit={submitBooking} className="grid gap-4 rounded-md bg-background p-6 text-foreground sm:grid-cols-2 sm:p-8"><label className="field-label">Event type<select name="eventType" required className="field"><option value="">Choose one</option>{["Wedding","Birthday party","Kitchen party","Corporate event","Conference","Traditional ceremony","Funeral","Private gathering"].map(v=><option key={v}>{v}</option>)}</select></label><label className="field-label">Meal package<select name="package" required className="field"><option value="">Choose one</option>{packages.map(v=><option key={v.name}>{v.name}</option>)}</select></label><label className="field-label">Event date<input name="date" type="date" required className="field"/></label><label className="field-label">Event time<input name="time" type="time" className="field"/></label><label className="field-label">Venue<input name="venue" required placeholder="Venue or area" className="field"/></label><label className="field-label">Number of guests<input name="guests" type="number" min="1" required placeholder="80" className="field"/></label><label className="field-label">Your name<input name="name" required className="field"/></label><label className="field-label">Phone number<input name="phone" type="tel" required className="field"/></label><label className="field-label sm:col-span-2">Email (optional)<input name="email" type="email" className="field"/></label><label className="field-label sm:col-span-2">Anything we should know?<textarea name="notes" rows={3} className="field resize-none"/></label>{bookingStage === "error" && <p className="rounded-sm bg-destructive/10 p-3 text-sm text-destructive sm:col-span-2">We couldn’t send your request. Please call us instead.</p>}<AppButton type="submit" disabled={bookingStage === "sending"} className="bg-primary text-primary-foreground sm:col-span-2">{bookingStage === "sending" ? "Sending…" : <>Request catering <ArrowRight size={17}/></>}</AppButton></form>
        )}
      </div></section>

      <section id="story" className="scroll-mt-18 py-20 lg:py-28"><div className="mx-auto grid max-w-7xl items-center gap-12 px-5 lg:grid-cols-2 lg:px-8"><img src={sundayPlatter} width={1024} height={1024} loading="lazy" alt="A generous Nalu's Kitchen sharing platter" className="aspect-[5/4] h-full w-full rounded-md object-cover"/><div><p className="eyebrow">Our table, your table</p><h2 className="section-title">Made with memory. Served with care.</h2><p className="mt-6 text-lg leading-8 text-muted-foreground">Nalu’s Kitchen began with a family table and neighbours looking for a proper home-cooked meal. We still slow-stir the nshima, pound fresh ingredients and give every order the same care—whether it feeds one person or a hundred.</p><div className="mt-8 grid gap-5 sm:grid-cols-2"><div className="border-t border-primary pt-4"><h3 className="font-semibold">Local ingredients</h3><p className="mt-1 text-sm text-muted-foreground">Fresh produce and honest flavours.</p></div><div className="border-t border-primary pt-4"><h3 className="font-semibold">Warm service</h3><p className="mt-1 text-sm text-muted-foreground">Every guest is welcomed like family.</p></div></div></div></div></section>
    </main>

    <footer id="contact" className="scroll-mt-18 bg-brand-ink py-14 text-brand-cream"><div className="mx-auto grid max-w-7xl gap-10 px-5 md:grid-cols-3 lg:px-8"><div><div className="flex items-center gap-3"><BrandMark/><span className="font-display text-xl">Nalu’s Kitchen</span></div><p className="mt-4 max-w-xs text-sm leading-6 text-brand-cream/60">Creating everlasting memories, one plate at a time.</p></div><div><p className="text-xs font-bold uppercase tracking-widest text-brand-gold">Find us</p><p className="mt-4 text-sm text-brand-cream/70">Solwezi, North-Western Province<br/>Open daily · 08:00–20:00</p></div><div><p className="text-xs font-bold uppercase tracking-widest text-brand-gold">Call to order</p><a href="tel:+260978408225" className="mt-4 flex items-center gap-2 text-lg"><Phone size={18}/> +260 978 408 225</a><a href="tel:+260968882622" className="mt-2 block text-brand-cream/70">+260 968 882 622</a></div></div><div className="mx-auto mt-12 max-w-7xl border-t border-brand-cream/15 px-5 pt-6 text-xs text-brand-cream/45 lg:px-8">© 2026 Nalu’s Kitchen · All prices in Zambian Kwacha</div></footer>

    {notice && <div className="fixed bottom-5 left-1/2 z-[70] w-[min(92%,560px)] -translate-x-1/2 rounded-sm bg-brand-ink px-5 py-4 text-center text-sm text-brand-cream shadow-2xl"><button onClick={() => setNotice("")} className="absolute right-2 top-2" aria-label="Close"><X size={16}/></button>{notice}</div>}
    {cartOpen && <><button className="fixed inset-0 z-50 bg-overlay" onClick={() => setCartOpen(false)} aria-label="Close order"/><aside className="fixed inset-y-0 right-0 z-[60] flex w-full max-w-md flex-col bg-background shadow-2xl"><div className="flex h-18 items-center justify-between border-b border-border px-6"><div className="flex items-center gap-3">{stage === "checkout" && <button onClick={()=>setStage("cart")} aria-label="Back to cart"><ChevronLeft/></button>}<h2 className="font-display text-2xl">{stage === "cart" ? "Your order" : stage === "checkout" ? "Checkout" : "Order placed"}</h2></div><button onClick={() => setCartOpen(false)} aria-label="Close"><X/></button></div><div className="flex-1 overflow-y-auto p-6">{stage === "cart" && <>{lines.length === 0 ? <div className="grid h-64 place-items-center text-center"><div><ShoppingBag className="mx-auto text-muted-foreground"/><p className="mt-4 text-muted-foreground">Your basket is waiting for something delicious.</p></div></div> : <div className="divide-y divide-border">{lines.map(line=><div key={line.id} className="flex gap-4 py-5">{photoFor(line.image_key) ? <img src={photoFor(line.image_key)!} width={1024} height={1024} loading="lazy" alt="" className="size-20 rounded-sm object-cover"/> : <div className="size-20 rounded-sm bg-muted"/>}<div className="min-w-0 flex-1"><h3 className="font-semibold">{line.name}</h3><p className="mt-1 text-sm text-muted-foreground">{money(line.price)} each</p><div className="mt-3 flex w-fit items-center rounded-sm border border-border"><button onClick={()=>adjust(line.id,-1)} className="grid size-8 place-items-center"><Minus size={14}/></button><span className="w-7 text-center text-sm">{line.quantity}</span><button onClick={()=>adjust(line.id,1)} className="grid size-8 place-items-center"><Plus size={14}/></button></div></div><strong>{money(line.price*line.quantity)}</strong></div>)}</div>}</>}{stage === "checkout" && <CheckoutForm total={total} mobileMoneyNumber={mobileMoneyNumber} busy={paymentBusy} onSubmit={submitOrder}/>} {stage === "success" && <div className="py-16 text-center"><div className="mx-auto grid size-16 place-items-center rounded-full bg-brand-green text-brand-cream"><Check size={30}/></div><p className="eyebrow mt-7">Thank you</p><h3 className="font-display text-3xl">Order #{orderRef}</h3><p className="mx-auto mt-4 max-w-xs text-muted-foreground">We’ve received your order and will call to confirm it.</p><AppButton onClick={()=>setCartOpen(false)} className="mt-8 bg-primary text-primary-foreground">Done</AppButton></div>}</div>{stage === "cart" && lines.length > 0 && <div className="border-t border-border p-6"><div className="mb-4 flex justify-between text-lg font-semibold"><span>Total</span><span>{money(total)}</span></div><AppButton onClick={()=>setStage("checkout")} className="w-full bg-primary text-primary-foreground">Continue to checkout <ArrowRight size={17}/></AppButton></div>}</aside></>}
  </div>;
}

function CheckoutForm({ total, mobileMoneyNumber: _mobileMoneyNumber, busy, onSubmit }: { total: number; mobileMoneyNumber: string; busy: boolean; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  const [fulfillment, setFulfillment] = useState("Pickup");
  const [payment, setPayment] = useState("Cash");
  return <form onSubmit={onSubmit} className="space-y-4"><div className="rounded-sm bg-muted p-4"><div className="flex justify-between font-semibold"><span>Order total</span><span>{money(total)}</span></div></div><label className="field-label">Full name<input name="name" required className="field"/></label><label className="field-label">Phone number<input name="phone" type="tel" required className="field"/></label>{payment === "Flutterwave" && <label className="field-label">Email address<input name="email" type="email" required placeholder="you@example.com" className="field"/><span className="text-xs font-normal text-muted-foreground">Flutterwave requires an email for online checkout.</span></label>}<fieldset><legend className="field-label">Your order</legend><div className="grid grid-cols-2 gap-2">{["Pickup","Delivery"].map(value=><label key={value} className={`cursor-pointer rounded-sm border p-3 text-center text-sm font-semibold ${fulfillment===value?"border-primary bg-primary/10":"border-border"}`}><input type="radio" name="fulfillment" value={value} checked={fulfillment===value} onChange={()=>setFulfillment(value)} className="sr-only"/>{value}</label>)}</div></fieldset>{fulfillment === "Delivery" && <label className="field-label">Delivery address<input name="address" required placeholder="Area, street and landmark" className="field"/></label>}<label className="field-label">Order notes<input name="notes" placeholder="Less spicy, no onions…" className="field"/></label><fieldset><legend className="field-label">Payment</legend><div className="grid grid-cols-2 gap-2">{["Cash","Flutterwave"].map(value=><label key={value} className={`cursor-pointer rounded-sm border p-3 text-center text-sm font-semibold ${payment===value?"border-primary bg-primary/10":"border-border"}`}><input type="radio" name="paymentMethod" value={value} checked={payment===value} onChange={()=>setPayment(value)} className="sr-only"/>{value === "Flutterwave" ? "Pay online" : value}</label>)}</div></fieldset>{payment === "Flutterwave" && <div className="rounded-sm border border-brand-gold bg-brand-gold/10 p-4 text-sm"><p><strong>Secure online checkout.</strong> Flutterwave will open a secure payment page where customers can choose the available card or Zambian mobile-money options.</p><p className="mt-2 text-xs text-muted-foreground">Your order is not marked paid until the server verifies the transaction.</p></div>}<AppButton type="submit" disabled={busy} className="w-full bg-primary text-primary-foreground">{busy ? "Opening secure payment…" : `Place order · ${money(total)}`}</AppButton></form>;
}