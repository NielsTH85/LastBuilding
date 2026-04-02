import { useRef } from "react";
import { useBuildStore } from "../store/useBuildStore";
import { saveBuild, loadBuild } from "@eob/serialization";

export default function BuildToolbar() {
  const build = useBuildStore((s) => s.build);
  const setBuild = useBuildStore((s) => s.setBuild);
  const resetBuild = useBuildStore((s) => s.resetBuild);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleSave() {
    const json = saveBuild(build);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `eob-build-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleLoad() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const loaded = loadBuild(reader.result as string);
        setBuild(loaded);
      } catch (err) {
        alert(`Failed to load build: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    };
    reader.readAsText(file);

    // Reset input so the same file can be re-selected
    e.target.value = "";
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleSave}
        className="rounded border border-slate-600 bg-slate-700 px-3 py-1 text-xs text-slate-200 hover:bg-slate-600"
        title="Export build to JSON file"
      >
        Export
      </button>
      <button
        onClick={handleLoad}
        className="rounded border border-slate-600 bg-slate-700 px-3 py-1 text-xs text-slate-200 hover:bg-slate-600"
        title="Import build from JSON file"
      >
        Import
      </button>
      <button
        onClick={resetBuild}
        className="rounded border border-red-800 bg-red-900/30 px-3 py-1 text-xs text-red-300 hover:bg-red-900/50"
      >
        Reset
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
