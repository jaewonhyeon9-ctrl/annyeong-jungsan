import { fmtWon } from "@/lib/format";

export function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: "default" | "primary" | "muted" | "positive";
}) {
  const toneCls =
    tone === "primary"
      ? "text-clay-600"
      : tone === "muted"
      ? "text-sand-600"
      : tone === "positive"
      ? "text-moss-600"
      : "text-sand-800";

  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wider text-sand-600">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-bold tabular ${toneCls}`}>
        {typeof value === "number" ? fmtWon(value) : value}
      </div>
      {hint && <div className="mt-1 text-xs text-sand-500">{hint}</div>}
    </div>
  );
}
