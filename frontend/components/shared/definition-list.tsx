export function DefinitionList({
  items,
}: {
  items: Array<{ label: string; value: React.ReactNode }>;
}) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="subpanel p-4">
          <dt className="text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">{item.label}</dt>
          <dd className="mt-2 text-sm font-semibold leading-6 text-[var(--foreground-strong)]">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
