import { useMemo } from "react";
import { getImportedWeaverTree } from "@eob/game-data";
import { PassiveTreeView } from "./PassiveTree";
import { useBuildStore } from "../store/useBuildStore";

export default function WeaverTree() {
  const tree = useMemo(() => getImportedWeaverTree(), []);
  const passives = useBuildStore((s) => s.build.passives);

  const points = useMemo(() => {
    let sum = 0;
    for (const p of passives) {
      if (p.nodeId.startsWith("weaver:")) sum += p.points;
    }
    return sum;
  }, [passives]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-4 border-b border-slate-700 pb-1">
        <span className="text-xs text-slate-500">
          Weaver Points: <span className="font-mono text-slate-300">{points}</span>
        </span>
      </div>
      <div className="min-h-0 flex-1 pt-2">
        <PassiveTreeView tree={tree} />
      </div>
    </div>
  );
}
