import { CURRENT_VERSION as FALLBACK_VERSION } from "@eob/serialization";
import { openUrl } from "@tauri-apps/plugin-opener";
import { check, type Update } from "@tauri-apps/plugin-updater";

const LATEST_RELEASE_API = "https://api.github.com/repos/NielsTH85/LastBuilding/releases/latest";

let pendingNativeUpdate: Update | null = null;

export interface UpdateCheckResult {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  releaseUrl: string;
  canInstallInApp: boolean;
}

export interface InstallUpdateResult {
  inAppInstall: boolean;
  restartRequired: boolean;
  releaseUrl?: string;
}

function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/i, "");
}

function compareSemver(a: string, b: string): number {
  const aParts = normalizeVersion(a)
    .split(".")
    .map((n) => Number.parseInt(n, 10));
  const bParts = normalizeVersion(b)
    .split(".")
    .map((n) => Number.parseInt(n, 10));

  const maxLen = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < maxLen; i += 1) {
    const av = aParts[i] ?? 0;
    const bv = bParts[i] ?? 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

async function getCurrentVersion(): Promise<string> {
  const tauriInternals = (
    globalThis as {
      __TAURI_INTERNALS__?: { invoke?: (cmd: string) => Promise<string> };
    }
  ).__TAURI_INTERNALS__;

  if (tauriInternals?.invoke) {
    try {
      const version = await tauriInternals.invoke("get_app_version");
      if (typeof version === "string" && version.trim()) {
        return normalizeVersion(version);
      }
    } catch {
      // Ignore and fall back to release-managed frontend version.
    }
  }

  return normalizeVersion(FALLBACK_VERSION);
}

async function checkViaGithubApi(currentVersion: string): Promise<UpdateCheckResult> {
  const res = await fetch(LATEST_RELEASE_API);
  if (!res.ok) {
    throw new Error(`Update check failed (${res.status})`);
  }

  const data = (await res.json()) as { tag_name?: string; html_url?: string };
  const latestVersion = normalizeVersion(data.tag_name ?? currentVersion);
  const releaseUrl = data.html_url ?? "https://github.com/NielsTH85/LastBuilding/releases/latest";

  return {
    currentVersion,
    latestVersion,
    releaseUrl,
    updateAvailable: compareSemver(latestVersion, currentVersion) > 0,
    canInstallInApp: false,
  };
}

export async function checkForUpdates(): Promise<UpdateCheckResult> {
  const currentVersion = await getCurrentVersion();

  // Preferred path: signed Tauri updater.
  try {
    const update = await check();
    if (update) {
      pendingNativeUpdate = update;
      return {
        currentVersion,
        latestVersion: normalizeVersion(update.version),
        releaseUrl: "https://github.com/NielsTH85/LastBuilding/releases/latest",
        updateAvailable: true,
        canInstallInApp: true,
      };
    }

    pendingNativeUpdate = null;
    return {
      currentVersion,
      latestVersion: currentVersion,
      releaseUrl: "https://github.com/NielsTH85/LastBuilding/releases/latest",
      updateAvailable: false,
      canInstallInApp: false,
    };
  } catch {
    // Fallback path if updater plugin or config is unavailable.
    pendingNativeUpdate = null;
    return checkViaGithubApi(currentVersion);
  }
}

export async function installAvailableUpdate(releaseUrl: string): Promise<InstallUpdateResult> {
  if (pendingNativeUpdate) {
    await pendingNativeUpdate.downloadAndInstall(() => {
      // Progress callback intentionally unused for now.
    });
    pendingNativeUpdate = null;
    return {
      inAppInstall: true,
      restartRequired: true,
    };
  }

  try {
    await openUrl(releaseUrl);
  } catch {
    window.open(releaseUrl, "_blank", "noopener,noreferrer");
  }

  return {
    inAppInstall: false,
    restartRequired: false,
    releaseUrl,
  };
}
