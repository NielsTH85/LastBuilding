import { useBuildStore } from "../store/useBuildStore";

function formatStat(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function DeltaCard() {
  const previewDelta = useBuildStore((s) => s.previewDelta);

  if (!previewDelta || previewDelta.length === 0) return null;

  return (
    <div className="rounded border border-slate-600 bg-slate-800/90 p-2 shadow-lg">
      <div className="mb-1 text-[10px] font-semibold uppercase text-slate-500">Preview</div>
      <div className="space-y-0.5">
        {previewDelta.map((d) => (
          <div key={d.statId} className="flex items-center justify-between gap-3 text-xs">
            <span className="text-slate-300">{formatStat(d.statId)}</span>
            <span className="flex items-center gap-1.5 font-mono">
              <span className="text-slate-500">{fmt(d.before)}</span>
              <span className="text-slate-600">→</span>
              <span className={d.diff > 0 ? "text-green-400" : "text-red-400"}>{fmt(d.after)}</span>
              <span className={`text-[10px] ${d.diff > 0 ? "text-green-500" : "text-red-500"}`}>
                ({d.diff > 0 ? "+" : ""}
                {fmt(d.diff)})
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function fmt(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}
