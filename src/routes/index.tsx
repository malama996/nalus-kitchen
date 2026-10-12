import { createFileRoute } from "@tanstack/react-router";
import { NalusKitchen } from "@/components/nalus-kitchen";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nalu’s Kitchen — Zambian Food & Catering in Solwezi" },
      { name: "description", content: "Order fresh Zambian meals for pickup or delivery, or book Nalu’s Kitchen for catering in Solwezi." },
      { property: "og:title", content: "Nalu’s Kitchen — Solwezi" },
      { property: "og:description", content: "Traditional Zambian food, fast favourites and event catering, cooked with care." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <NalusKitchen />;
}
