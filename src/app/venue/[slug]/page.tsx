import { Suspense } from "react";
import { VenueMenu } from "@/components/VenueMenu";

export default function VenuePage(props: PageProps<"/venue/[slug]">) {
  return (
    <Suspense fallback={<main className="muted">Loading…</main>}>
      <Venue {...props} />
    </Suspense>
  );
}

async function Venue({ params, searchParams }: PageProps<"/venue/[slug]">) {
  const { slug } = await params;
  const { currency } = await searchParams;
  return <VenueMenu slug={slug} currency={typeof currency === "string" && currency ? currency : "EUR"} />;
}
