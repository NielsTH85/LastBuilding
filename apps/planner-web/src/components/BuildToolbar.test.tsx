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

describe("BuildToolbar Pastebin integration", () => {
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

  it("exports to Pastebin through proxy health + create endpoints", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: "https://pastebin.com/abcd1234" }),
      });

    render(<BuildToolbar />);

    fireEvent.click(screen.getByRole("button", { name: "Export ▾" }));
    fireEvent.click(screen.getByRole("button", { name: "To Pastebin" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(screen.getByText("Build Exported to Pastebin")).toBeTruthy();
      expect(screen.getByDisplayValue("https://pastebin.com/abcd1234")).toBeTruthy();
    });

    expect(fetchMock.mock.calls[0]?.[0]).toContain("/health");
    expect(fetchMock.mock.calls[1]?.[0]).toContain("/api/pastebin/create");
  });

  it("imports from Pastebin through proxy health + raw endpoints", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ key: "abcd1234", raw: '{"version":"test"}' }),
      });

    render(<BuildToolbar />);

    fireEvent.click(screen.getByRole("button", { name: "Import ▾" }));
    fireEvent.click(screen.getByRole("button", { name: "From Pastebin" }));

    const input = screen.getByPlaceholderText("https://pastebin.com/...");
    fireEvent.change(input, { target: { value: "https://pastebin.com/abcd1234" } });
    fireEvent.click(screen.getByRole("button", { name: "Import" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(loadBuildMock).toHaveBeenCalledWith('{"version":"test"}');
      expect(setBuildMock).toHaveBeenCalledTimes(1);
    });

    expect(fetchMock.mock.calls[0]?.[0]).toContain("/health");
    expect(fetchMock.mock.calls[1]?.[0]).toContain("/api/pastebin/raw/abcd1234");
  });

  it("shows actionable proxy setup guidance when health check fails", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ ok: false }) });

    render(<BuildToolbar />);

    fireEvent.click(screen.getByRole("button", { name: "Export ▾" }));
    fireEvent.click(screen.getByRole("button", { name: "To Pastebin" }));

    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledTimes(1);
    });

    const message = String(alertMock.mock.calls[0]?.[0] ?? "");
    expect(message).toContain("Set PASTEBIN_DEV_KEY");
    expect(message).toContain("pnpm --filter pastebin-proxy dev");
    expect(message).toContain("/health");
  });
});
