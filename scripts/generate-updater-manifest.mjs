import fs from "node:fs";
import path from "node:path";

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, out);
    } else {
      out.push(fullPath);
    }
  }
  return out;
}

function normalizeTag(tag) {
  return tag.startsWith("v") ? tag.slice(1) : tag;
}

const workspace = process.cwd();
const bundleRoot = path.join(workspace, "apps", "planner-web", "src-tauri", "target", "release", "bundle");
const releaseTag = process.env.RELEASE_TAG;
const repo = process.env.GITHUB_REPOSITORY;

if (!releaseTag) {
  throw new Error("RELEASE_TAG is required");
}
if (!repo) {
  throw new Error("GITHUB_REPOSITORY is required");
}
if (!fs.existsSync(bundleRoot)) {
  throw new Error(`Bundle path not found: ${bundleRoot}`);
}

const allFiles = walk(bundleRoot);
const sigFiles = allFiles.filter((f) => f.endsWith(".sig"));

if (sigFiles.length === 0) {
  throw new Error("No signature files found. Ensure TAURI_SIGNING_PRIVATE_KEY is configured.");
}

const updaterCandidates = sigFiles
  .map((sigPath) => {
    const assetPath = sigPath.slice(0, -4);
    return { sigPath, assetPath };
  })
  .filter(({ assetPath }) => fs.existsSync(assetPath))
  .filter(
    ({ assetPath }) =>
      assetPath.endsWith(".zip") ||
      assetPath.endsWith(".tar.gz") ||
      assetPath.endsWith(".AppImage") ||
      assetPath.endsWith(".exe") ||
      assetPath.endsWith(".msi"),
  );

if (updaterCandidates.length === 0) {
  throw new Error(
    "No signed updater artifact found (.exe/.msi/.zip/.tar.gz/.AppImage). Ensure createUpdaterArtifacts is enabled.",
  );
}

const preferred =
  updaterCandidates.find(({ assetPath }) => assetPath.endsWith(".exe")) ??
  updaterCandidates.find(({ assetPath }) => assetPath.endsWith(".msi")) ??
  updaterCandidates.find(({ assetPath }) => assetPath.endsWith(".zip")) ??
  updaterCandidates.find(({ assetPath }) => assetPath.endsWith(".tar.gz")) ??
  updaterCandidates[0];
if (!preferred) {
  throw new Error("Unable to select updater asset.");
}

const signature = fs.readFileSync(preferred.sigPath, "utf8").trim();
const assetName = path.basename(preferred.assetPath);
const sigName = path.basename(preferred.sigPath);

const manifest = {
  version: normalizeTag(releaseTag),
  notes: "See GitHub release notes.",
  pub_date: new Date().toISOString(),
  platforms: {
    "windows-x86_64": {
      signature,
      url: `https://github.com/${repo}/releases/download/${releaseTag}/${assetName}`,
    },
  },
};

const manifestPath = path.join(bundleRoot, "latest.json");
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

console.log(`Selected updater asset: ${assetName}`);
console.log(`Selected signature: ${sigName}`);
console.log(`Generated manifest: ${manifestPath}`);
