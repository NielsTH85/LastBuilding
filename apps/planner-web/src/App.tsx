import { useState, useCallback, useEffect, useRef } from "react";
import { createEmptyBuild } from "@eob/build-model";
import { getImportedClasses } from "@eob/game-data";
import PassiveTree from "./components/PassiveTree";
import SkillBar from "./components/SkillBar";
import ItemEditor from "./components/ItemEditor";
import IdolEditor from "./components/IdolEditor";
import StatPanel from "./components/StatPanel";
import ConfigPanel from "./components/ConfigPanel";
import CalculationsPanel from "./components/CalculationsPanel";
import WeaverTree from "./components/WeaverTree";
import DeltaCard from "./components/DeltaCard";
import BuildToolbar from "./components/BuildToolbar";
import BuildList from "./components/BuildList";
import ClassSelect from "./components/ClassSelect";
import MaxrollImport from "./components/MaxrollImport";
import { checkForUpdates, installAvailableUpdate } from "./lib/updater";
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
type Tab = "passives" | "weaver" | "skills" | "equipment" | "idols" | "config" | "calculations";

const TABS: { id: Tab; label: string }[] = [
  { id: "passives", label: "Passive Tree" },
  { id: "skills", label: "Skills" },
  { id: "equipment", label: "Equipment" },
  { id: "idols", label: "Idols" },
  { id: "weaver", label: "Weaver" },
  { id: "config", label: "Configuration" },
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

function formatUnknownError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("build-list");
  const [activeTab, setActiveTab] = useState<Tab>("passives");
  const [builds, setBuilds] = useState<SavedBuildEntry[]>(listSavedBuilds);
  const [activeBuildId, setActiveBuildId] = useState<string | null>(null);
  const [buildName, setBuildName] = useState("New Build");
  const [updateChecking, setUpdateChecking] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateLabel, setUpdateLabel] = useState("Update status: not checked");
  const [updateUrl, setUpdateUrl] = useState<string | null>(null);
  const autoCheckedRef = useRef(false);

  const setBuild = useBuildStore((s) => s.setBuild);
  const build = useBuildStore((s) => s.build);

  const refreshBuilds = useCallback(() => setBuilds(listSavedBuilds()), []);

  const handleCheckUpdates = useCallback(async (silent = false) => {
    if (updateChecking) return;
    setUpdateChecking(true);
    setUpdateLabel("Update status: checking...");
    try {
      const result = await checkForUpdates();
      setUpdateAvailable(result.updateAvailable);
      setUpdateUrl(result.releaseUrl);

      if (result.updateAvailable) {
        setUpdateLabel(
          result.canInstallInApp
            ? `Update ready: v${result.latestVersion} (current v${result.currentVersion})`
            : `Update available: v${result.latestVersion} (current v${result.currentVersion})`,
        );
        if (!silent) {
          if (result.canInstallInApp) {
            alert(
              `Signed update found: v${result.latestVersion}. Click Update to download and install in-app.`,
            );
          } else {
            alert(
              `Update available: v${result.latestVersion}. Current version is v${result.currentVersion}.`,
            );
          }
        }
      } else {
        setUpdateLabel(`Up to date: v${result.currentVersion}`);
        if (!silent) {
          alert(`You are up to date on v${result.currentVersion}.`);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setUpdateAvailable(false);
      setUpdateLabel(`Update check failed: ${message}`);
      if (!silent) {
        alert(`Update check failed: ${message}`);
      }
    } finally {
      setUpdateChecking(false);
    }
  }, [updateChecking]);

  const handleInstallUpdate = useCallback(async () => {
    const url = updateUrl ?? "https://github.com/NielsTH85/LastBuilding/releases/latest";
    try {
      const result = await installAvailableUpdate(url);
      if (result.inAppInstall) {
        alert("Update installed. Please restart Last Building to finish applying it.");
      }
    } catch (err) {
      alert(`Update install failed: ${formatUnknownError(err)}`);
    }
  }, [updateUrl]);

  useEffect(() => {
    if (autoCheckedRef.current) return;
    autoCheckedRef.current = true;
    void handleCheckUpdates(true);
  }, [handleCheckUpdates]);

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
    b.progression = imported.progression;
    b.idols = imported.idols;
    b.extraModifiers = imported.extraModifiers;
    for (const eq of imported.equipment) {
      b.equipment[eq.slot] = {
        baseId: eq.baseId,
        rarity: eq.rarity,
        affixes: eq.affixes,
        implicitRolls: eq.implicitRolls,
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
        updateChecking={updateChecking}
        updateAvailable={updateAvailable}
        updateLabel={updateLabel}
        onCheckUpdates={() => {
          void handleCheckUpdates(false);
        }}
        onInstallUpdate={() => {
          void handleInstallUpdate();
        }}
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
    <div className="app-shell">
      <div className="app-overlay flex h-screen flex-col">
      <header className="le-header flex items-center justify-between px-6 py-2.5">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBackToList}
            className="le-button-ghost rounded px-2 py-1 text-xs"
          >
            ← Builds
          </button>
          <h1 className="le-title text-xl font-bold text-amber-200">{buildName}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              void handleCheckUpdates(false);
            }}
            disabled={updateChecking}
            className="le-button-ghost rounded px-3 py-1 text-xs disabled:opacity-50"
          >
            {updateChecking ? "Checking..." : "Check Updates"}
          </button>
          {updateAvailable && (
            <button
              onClick={() => {
                void handleInstallUpdate();
              }}
              className="le-button rounded px-3 py-1 text-xs"
            >
              Update Available
            </button>
          )}
          <button
            onClick={handleSaveBuild}
            className="le-button rounded px-3 py-1 text-xs"
          >
            Save
          </button>
          <div className="le-toolbar">
            <BuildToolbar />
          </div>
        </div>
        <span className="text-sm text-slate-300">
          {classLabel}
          {masteryLabel && ` → ${masteryLabel}`}
        </span>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Main content area with tabs */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {/* Tab bar */}
          <nav className="le-nav flex px-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`le-tab px-5 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "is-active text-amber-200"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Tab content */}
          <div className="le-main-canvas flex-1 overflow-y-auto p-4">
            {activeTab === "passives" && (
              <div className="h-full">
                <PassiveTree />
              </div>
            )}
            {activeTab === "weaver" && (
              <div className="h-full">
                <WeaverTree />
              </div>
            )}
            {activeTab === "skills" && <SkillBar />}
            {activeTab === "equipment" && <ItemEditor />}
            {activeTab === "idols" && <IdolEditor />}
            {activeTab === "config" && <ConfigPanel />}
            {activeTab === "calculations" && (
              <div className="h-full overflow-hidden -m-4">
                <CalculationsPanel />
              </div>
            )}
          </div>
        </main>

        {/* Right: Stat panel — always visible */}
        {activeTab !== "calculations" && (
          <aside className="le-aside flex w-72 min-h-0 flex-col overflow-hidden">
            <h2 className="le-title flex-shrink-0 px-3 pt-3 text-sm font-semibold uppercase text-slate-300">
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
    </div>
  );
}
