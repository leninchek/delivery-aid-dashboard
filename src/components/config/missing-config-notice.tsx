type MissingConfigNoticeProps = {
  missingVars: string[];
  title?: string;
  description?: string;
};

export function MissingConfigNotice({
  missingVars,
  title = "Firebase no esta configurado",
  description = "Completa las variables de entorno para habilitar autenticacion, Firestore y Cloud Functions.",
}: MissingConfigNoticeProps) {
  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm">{description}</p>
      <ul className="mt-4 list-disc space-y-1 pl-5 text-sm">
        {missingVars.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
