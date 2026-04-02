import { useState, useCallback } from "react";
import { createEmptyBuild } from "@eob/build-model";
import { getImportedClasses } from "@eob/game-data";
import PassiveTree from "./components/PassiveTree";
import SkillBar from "./components/SkillBar";
import ItemEditor from "./components/ItemEditor";
import IdolEditor from "./components/IdolEditor";
import StatPanel from "./components/StatPanel";
import CalculationsPanel from "./components/CalculationsPanel";
import DeltaCard from "./components/DeltaCard";
import BuildToolbar from "./components/BuildToolbar";
import BuildList from "./components/BuildList";
import ClassSelect from "./components/ClassSelect";
import MaxrollImport from "./components/MaxrollImport";
import { useBuildStore } from "./store/useBuildStore";
import {
  listSavedBuilds,
  saveBuildToStorage,
  loadBuildFromStorage,
  deleteBuildFromStorage,
  type SavedBuildEntry,
} from "./store/buildStorage";
import type { ImportedBuild } from "@eob/game-data";

type Screen = "build-list" | "class-select" | "planner" | "maxroll-import";
type Tab = "passives" | "skills" | "equipment" | "idols" | "calculations";

const TABS: { id: Tab; label: string }[] = [
  { id: "passives", label: "Passive Tree" },
  { id: "skills", label: "Skills" },
  { id: "equipment", label: "Equipment" },
  { id: "idols", label: "Idols" },
  { id: "calculations", label: "Calculations" },
];

const allClasses = getImportedClasses();

function getClassLabel(classId: string): string {
  return allClasses.find((c) => c.id === classId)?.name ?? classId;
}

function getMasteryLabel(classId: string, masteryId: string): string {
  const cls = allClasses.find((c) => c.id === classId);
  return cls?.masteries.find((m) => m.id === masteryId)?.name ?? masteryId;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("build-list");
  const [activeTab, setActiveTab] = useState<Tab>("passives");
  const [builds, setBuilds] = useState<SavedBuildEntry[]>(listSavedBuilds);
  const [activeBuildId, setActiveBuildId] = useState<string | null>(null);
  const [buildName, setBuildName] = useState("New Build");

  const setBuild = useBuildStore((s) => s.setBuild);
  const build = useBuildStore((s) => s.build);

  const refreshBuilds = useCallback(() => setBuilds(listSavedBuilds()), []);

  // ── Build list handlers ──────────────────────────────

  function handleSelectBuild(id: string) {
    try {
      const loaded = loadBuildFromStorage(id);
      setBuild(loaded);
      const entry = builds.find((b) => b.id === id);
      setActiveBuildId(id);
      setBuildName(entry?.name ?? "Build");
      setScreen("planner");
    } catch (err) {
      alert(`Failed to load build: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  function handleDeleteBuild(id: string) {
    deleteBuildFromStorage(id);
    refreshBuilds();
  }

  // ── Class select handler ─────────────────────────────

  function handleClassSelect(classId: string, masteryId?: string) {
    const fresh = createEmptyBuild(classId, masteryId);
    setBuild(fresh);
    setActiveBuildId(null);
    setBuildName("New Build");
    setScreen("planner");
  }

  function handleMaxrollImport(imported: ImportedBuild, name: string) {
    const b = createEmptyBuild(imported.classId, imported.masteryId);
    b.character.level = imported.level;
    b.idolAltarId = imported.idolAltarId;
    b.passives = imported.passives;
    b.skills = imported.skills;
    b.idols = imported.idols;
    b.extraModifiers = imported.extraModifiers;
    for (const eq of imported.equipment) {
      b.equipment[eq.slot] = {
        baseId: eq.baseId,
        rarity: eq.rarity,
        affixes: eq.affixes,
        uniqueId: eq.uniqueId,
        uniqueName: eq.uniqueName,
        uniqueEffects: eq.uniqueEffects,
      };
    }
    setBuild(b);
    setActiveBuildId(null);
    setBuildName(name);
    setScreen("planner");
  }

  // ── Planner toolbar handlers ─────────────────────────

  function handleSaveBuild() {
    const name = prompt("Build name:", buildName);
    if (!name) return;
    const id = saveBuildToStorage(build, name, activeBuildId ?? undefined);
    setActiveBuildId(id);
    setBuildName(name);
    refreshBuilds();
  }

  function handleBackToList() {
    setScreen("build-list");
    refreshBuilds();
  }

  // ── Screens ──────────────────────────────────────────

  if (screen === "build-list") {
    return (
      <BuildList
        builds={builds}
        onSelect={handleSelectBuild}
        onDelete={handleDeleteBuild}
        onNewBuild={() => setScreen("class-select")}
        onImportMaxroll={() => setScreen("maxroll-import")}
      />
    );
  }

  if (screen === "class-select") {
    return <ClassSelect onSelect={handleClassSelect} onBack={() => setScreen("build-list")} />;
  }

  if (screen === "maxroll-import") {
    return (
      <MaxrollImport onImport={handleMaxrollImport} onCancel={() => setScreen("build-list")} />
    );
  }

  const classLabel = getClassLabel(build.character.classId);
  const masteryLabel = build.character.masteryId
    ? getMasteryLabel(build.character.classId, build.character.masteryId)
    : null;

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-slate-700 bg-slate-800 px-6 py-2">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBackToList}
            className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-700 hover:text-slate-200"
          >
            ← Builds
          </button>
          <h1 className="text-xl font-bold text-amber-400">{buildName}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveBuild}
            className="rounded border border-slate-600 bg-slate-700 px-3 py-1 text-xs text-slate-200 hover:bg-slate-600"
          >
            Save
          </button>
          <BuildToolbar />
        </div>
        <span className="text-sm text-slate-400">
          {classLabel}
          {masteryLabel && ` → ${masteryLabel}`}
        </span>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Main content area with tabs */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {/* Tab bar */}
          <nav className="flex border-b border-slate-700 bg-slate-900">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "border-b-2 border-amber-400 text-amber-300"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto bg-slate-950 p-4">
            {activeTab === "passives" && (
              <div className="h-full">
                <PassiveTree />
              </div>
            )}
            {activeTab === "skills" && <SkillBar />}
            {activeTab === "equipment" && <ItemEditor />}
            {activeTab === "idols" && <IdolEditor />}
            {activeTab === "calculations" && (
              <div className="h-full overflow-hidden -m-4">
                <CalculationsPanel />
              </div>
            )}
          </div>
        </main>

        {/* Right: Stat panel — always visible */}
        {activeTab !== "calculations" && (
          <aside className="flex w-72 min-h-0 flex-col overflow-hidden border-l border-slate-700 bg-slate-900">
            <h2 className="flex-shrink-0 px-3 pt-3 text-sm font-semibold uppercase text-slate-400">
              Stats
            </h2>
            <div className="flex-shrink-0 px-3 py-1">
              <DeltaCard />
            </div>
            <StatPanel />
          </aside>
        )}
      </div>
    </div>
  );
}
