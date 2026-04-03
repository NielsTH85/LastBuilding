import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import BuildToolbar from "./BuildToolbar";

const saveBuildMock = vi.fn(() => '{"version":"test"}');
const loadBuildMock = vi.fn((_: string) => ({
  version: "test",
  character: { classId: "mage", masteryId: "runemaster", level: 1 },
  passives: [],
  skills: [],
  equipment: {},
  idols: [],
  blessings: [],
  toggles: [],
  config: { enemyLevel: 100 },
}));

const setBuildMock = vi.fn();
const resetBuildMock = vi.fn();

vi.mock("@eob/serialization", () => ({
  saveBuild: () => saveBuildMock(),
  loadBuild: (json: string) => loadBuildMock(json),
}));

vi.mock("../store/useBuildStore", () => {
  const build = {
    version: "test",
    character: { classId: "mage", masteryId: "runemaster", level: 1 },
    passives: [],
    skills: [],
    equipment: {},
    idols: [],
    blessings: [],
    toggles: [],
    config: { enemyLevel: 100 },
  };

  return {
    useBuildStore: (selector: (state: Record<string, unknown>) => unknown) =>
      selector({
        build,
        setBuild: setBuildMock,
        resetBuild: resetBuildMock,
      }),
  };
});

describe("BuildToolbar dpaste integration", () => {
  const originalFetch = globalThis.fetch;
  const fetchMock = vi.fn();
  const alertMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    vi.stubGlobal("alert", alertMock);
  });

  afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
    vi.unstubAllGlobals();
  });

  it("exports to dpaste and shows returned URL", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, text: async () => "https://dpaste.com/abcd1234" });

    render(<BuildToolbar />);

    fireEvent.click(screen.getByRole("button", { name: "Export ▾" }));
    fireEvent.click(screen.getByRole("button", { name: "To dpaste" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Build Exported to dpaste")).toBeTruthy();
      expect(screen.getByDisplayValue("https://dpaste.com/abcd1234")).toBeTruthy();
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://dpaste.com/api/");
  });

  it("imports from dpaste using raw .txt URL", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, text: async () => '{"version":"test"}' });

    render(<BuildToolbar />);

    fireEvent.click(screen.getByRole("button", { name: "Import ▾" }));
    fireEvent.click(screen.getByRole("button", { name: "From dpaste" }));

    const input = screen.getByPlaceholderText("https://dpaste.com/...");
    fireEvent.change(input, { target: { value: "https://dpaste.com/abcd1234" } });
    fireEvent.click(screen.getByRole("button", { name: "Import" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(loadBuildMock).toHaveBeenCalledWith('{"version":"test"}');
      expect(setBuildMock).toHaveBeenCalledTimes(1);
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://dpaste.com/abcd1234.txt");
  });

  it("shows dpaste export error when upload fails", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503, text: async () => "" });

    render(<BuildToolbar />);

    fireEvent.click(screen.getByRole("button", { name: "Export ▾" }));
    fireEvent.click(screen.getByRole("button", { name: "To dpaste" }));

    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledTimes(1);
    });

    const message = String(alertMock.mock.calls[0]?.[0] ?? "");
    expect(message).toContain("dpaste export failed");
    expect(message).toContain("dpaste upload failed (503)");
  });
});
