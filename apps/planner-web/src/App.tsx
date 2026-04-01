export default function App() {
  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-slate-700 bg-slate-800 px-6 py-3">
        <h1 className="text-xl font-bold text-amber-400">Epoch of Building</h1>
        <span className="text-sm text-slate-400">Mage → Runemaster</span>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Passive tree */}
        <aside className="flex w-64 flex-col border-r border-slate-700 bg-slate-900 p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase text-slate-400">Passives</h2>
          <p className="text-sm text-slate-500">Coming soon…</p>
        </aside>

        {/* Center: Skills / Items */}
        <main className="flex-1 bg-slate-950 p-6">
          <h2 className="mb-2 text-sm font-semibold uppercase text-slate-400">Build Editor</h2>
          <p className="text-sm text-slate-500">Select skills and equip items here.</p>
        </main>

        {/* Right: Stat panel */}
        <aside className="flex w-72 flex-col border-l border-slate-700 bg-slate-900 p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase text-slate-400">Stats</h2>
          <p className="text-sm text-slate-500">Snapshot output will appear here.</p>
        </aside>
      </div>
    </div>
  );
}
