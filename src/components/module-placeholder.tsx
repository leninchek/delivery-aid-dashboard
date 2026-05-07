type ModulePlaceholderProps = {
  title: string;
  summary: string;
  nextSteps: string[];
};

export function ModulePlaceholder({
  title,
  summary,
  nextSteps,
}: ModulePlaceholderProps) {
  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-3xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-2 text-sm text-slate-600">{summary}</p>
      </header>

      <article className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Proximos pasos
        </h3>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
          {nextSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      </article>
    </section>
  );
}
