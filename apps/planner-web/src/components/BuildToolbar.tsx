import { useEffect, useRef, useState } from "react";
import { useBuildStore } from "../store/useBuildStore";
import { saveBuild, loadBuild } from "@eob/serialization";

// ── Pastebin proxy helpers ─────────────────────────────

const PASTEBIN_PROXY_BASE = (import.meta.env.VITE_PASTEBIN_PROXY_URL ?? "http://127.0.0.1:8787").replace(/\/$/, "");

function normalizePasteKey(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  const direct = value.match(/^[a-zA-Z0-9]{4,}$/);
  if (direct) return direct[0];

  try {
    const url = new URL(value);
    if (!url.hostname.includes("pastebin.com")) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length === 0) return null;
    if (parts[0] === "raw" && parts[1]) return parts[1];
    return parts[0] ?? null;
  } catch {
    return null;
  }
}

async function uploadToPastebin(json: string): Promise<string> {
  const res = await fetch(`${PASTEBIN_PROXY_BASE}/api/pastebin/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: json,
      title: "Epoch of Building Export",
    }),
  });

  const payload = (await res.json()) as { url?: string; error?: string };
  if (!res.ok || !payload.url) {
    throw new Error(payload.error || `Pastebin export failed (${res.status})`);
  }

  return payload.url;
}

async function downloadFromPastebin(url: string): Promise<string> {
  const key = normalizePasteKey(url);
  if (!key) {
    throw new Error("Please provide a valid pastebin.com URL or paste key");
  }

  const res = await fetch(`${PASTEBIN_PROXY_BASE}/api/pastebin/raw/${encodeURIComponent(key)}`);
  const payload = (await res.json()) as { raw?: string; error?: string };
  if (!res.ok || typeof payload.raw !== "string") {
    throw new Error(payload.error || `Pastebin import failed (${res.status})`);
  }

  return payload.raw;
}

// ── Dropdown menu ──────────────────────────────────────

function DropdownMenu({
  label,
  items,
}: {
  label: string;
  items: { label: string; onClick: () => void }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded border border-slate-600 bg-slate-700 px-3 py-1 text-xs text-slate-200 hover:bg-slate-600"
      >
        {label} ▾
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 min-w-[140px] rounded border border-slate-600 bg-slate-800 py-1 shadow-xl">
          {items.map((item) => (
            <button
              key={item.label}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className="block w-full px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-slate-700"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Pastebin modal ─────────────────────────────────────

function PastebinModal({
  mode,
  onClose,
  value,
  onImport,
}: {
  mode: "export" | "import";
  onClose: () => void;
  value?: string; // paste URL for export mode
  onImport?: (url: string) => void;
}) {
  const [url, setUrl] = useState(value ?? "");
  const [copied, setCopied] = useState(false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-96 rounded-lg border border-slate-600 bg-slate-800 p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-3 text-sm font-bold text-slate-200">
          {mode === "export" ? "Build Exported to Pastebin" : "Import from Pastebin"}
        </h3>

        {mode === "export" ? (
          <>
            <p className="mb-2 text-xs text-slate-400">
              Share this link:
            </p>
            <div className="flex gap-2">
              <input
                readOnly
                value={url}
                className="flex-1 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-200"
                onFocus={(e) => e.target.select()}
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(url);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="rounded border border-slate-600 bg-slate-700 px-3 py-1 text-xs text-slate-200 hover:bg-slate-600"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mb-2 text-xs text-slate-400">
              Paste a pastebin.com URL (or paste key):
            </p>
            <div className="flex gap-2">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://pastebin.com/..."
                className="flex-1 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-200 placeholder:text-slate-600"
              />
              <button
                onClick={() => onImport?.(url)}
                className="rounded border border-teal-700 bg-teal-900/40 px-3 py-1 text-xs text-teal-300 hover:bg-teal-900/60"
              >
                Import
              </button>
            </div>
          </>
        )}

        <button
          onClick={onClose}
          className="mt-3 w-full rounded border border-slate-600 bg-slate-700 py-1 text-xs text-slate-300 hover:bg-slate-600"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ── Main toolbar ───────────────────────────────────────

export default function BuildToolbar() {
  const build = useBuildStore((s) => s.build);
  const setBuild = useBuildStore((s) => s.setBuild);
  const resetBuild = useBuildStore((s) => s.resetBuild);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [modal, setModal] = useState<
    | { mode: "export"; url: string }
    | { mode: "import" }
    | { mode: "loading"; label: string }
    | null
  >(null);

  // ── Export handlers ──────────────────────────────────

  function handleExportFile() {
    const json = saveBuild(build);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `eob-build-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleExportPastebin() {
    setModal({ mode: "loading", label: "Uploading…" });
    try {
      const json = saveBuild(build);
      const pasteUrl = await uploadToPastebin(json);
      setModal({ mode: "export", url: pasteUrl });
    } catch (err) {
      alert(`Pastebin export failed: ${err instanceof Error ? err.message : "Unknown error"}`);
      setModal(null);
    }
  }

  function handleExportClipboard() {
    const json = saveBuild(build);
    navigator.clipboard.writeText(json).then(
      () => alert("Build JSON copied to clipboard!"),
      () => alert("Failed to copy to clipboard."),
    );
  }

  // ── Import handlers ──────────────────────────────────

  function handleImportFile() {
    fileInputRef.current?.click();
  }

  function handleImportPastebin() {
    setModal({ mode: "import" });
  }

  async function handleImportFromUrl(url: string) {
    setModal({ mode: "loading", label: "Downloading…" });
    try {
      const json = await downloadFromPastebin(url);
      const loaded = loadBuild(json);
      setBuild(loaded);
      setModal(null);
    } catch (err) {
      alert(`Pastebin import failed: ${err instanceof Error ? err.message : "Unknown error"}`);
      setModal(null);
    }
  }

  function handleImportClipboard() {
    navigator.clipboard.readText().then(
      (text) => {
        try {
          const loaded = loadBuild(text);
          setBuild(loaded);
        } catch (err) {
          alert(`Clipboard import failed: ${err instanceof Error ? err.message : "Invalid data"}`);
        }
      },
      () => alert("Failed to read clipboard."),
    );
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
    e.target.value = "";
  }

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu
        label="Export"
        items={[
          { label: "To File", onClick: handleExportFile },
          { label: "To Pastebin", onClick: handleExportPastebin },
          { label: "To Clipboard", onClick: handleExportClipboard },
        ]}
      />
      <DropdownMenu
        label="Import"
        items={[
          { label: "From File", onClick: handleImportFile },
          { label: "From Pastebin", onClick: handleImportPastebin },
          { label: "From Clipboard", onClick: handleImportClipboard },
        ]}
      />
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

      {/* Pastebin modal */}
      {modal?.mode === "export" && (
        <PastebinModal mode="export" value={modal.url} onClose={() => setModal(null)} />
      )}
      {modal?.mode === "import" && (
        <PastebinModal mode="import" onClose={() => setModal(null)} onImport={handleImportFromUrl} />
      )}
      {modal?.mode === "loading" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="rounded-lg border border-slate-600 bg-slate-800 px-6 py-4 text-sm text-slate-300 shadow-2xl">
            {modal.label}
          </div>
        </div>
      )}
    </div>
  );
}
