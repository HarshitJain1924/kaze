import type { MediaDetailFact } from "@/lib/media/detail-view";

export function MediaDetailFacts({
  facts,
  title = "Technical Details",
}: {
  facts: MediaDetailFact[];
  title?: string;
}) {
  if (facts.length === 0) return null;

  return (
    <section aria-labelledby="details-heading">
      <h2 id="details-heading" className="font-display text-lg font-semibold text-fg">
        {title}
      </h2>
      <dl className="optical-glass mt-3 grid grid-cols-2 gap-x-6 gap-y-4 p-5 sm:grid-cols-3">
        {facts.map((fact) => (
          <div key={`${fact.label}:${fact.value}`}>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50">
              {fact.label}
            </dt>
            <dd className="mt-1 text-sm text-white/90">{fact.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
