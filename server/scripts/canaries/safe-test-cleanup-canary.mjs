// Regression test for the path validator introduced by
// docs/incident-profile-image-data-loss-20260717.md: proves
// assertSafeTestDeletePath() rejects every class of dangerous path that
// could repeat the incident (deleting real production uploads via a test
// cleanup command), and accepts only genuine mktemp-created directories.
//
//   node server/scripts/canaries/safe-test-cleanup-canary.mjs
//
import assert from "node:assert/strict";
import path from "node:path";
import { access } from "node:fs/promises";
import {
  assertSafeTestDeletePath,
  createIsolatedTestDir,
  safeRemoveTestDirectory,
  UnsafeDeletePathError,
} from "../../lib/safeTestCleanup.js";

let checks = 0;
function check(label, condition) {
  checks += 1;
  assert.ok(condition, `FAILED: ${label}`);
  console.log(`  [${checks}] PASS - ${label}`);
}

function expectRejected(label, fn) {
  try {
    fn();
    check(label, false);
  } catch (error) {
    check(label, error instanceof UnsafeDeletePathError);
  }
}

const REPO_ROOT = "/srv/nexis/source/NexisGame";
const PRODUCTION_UPLOAD_DIR = "/srv/nexis/shared/profile-images";

async function main() {
  console.log("== Dangerous paths are all rejected ==");
  expectRejected("empty string", () => assertSafeTestDeletePath(""));
  expectRejected("whitespace-only string", () => assertSafeTestDeletePath("   "));
  expectRejected("undefined", () => assertSafeTestDeletePath(undefined));
  expectRejected("null", () => assertSafeTestDeletePath(null));
  expectRejected("root /", () => assertSafeTestDeletePath("/"));
  expectRejected("/srv", () => assertSafeTestDeletePath("/srv"));
  expectRejected("/root", () => assertSafeTestDeletePath("/root"));
  expectRejected("/etc", () => assertSafeTestDeletePath("/etc"));
  expectRejected("repository root", () =>
    assertSafeTestDeletePath(REPO_ROOT, { repoRoot: REPO_ROOT, productionUploadDir: PRODUCTION_UPLOAD_DIR }),
  );
  expectRejected("the exact historical incident path: repoRoot/.data", () =>
    assertSafeTestDeletePath(path.join(REPO_ROOT, ".data"), { repoRoot: REPO_ROOT, productionUploadDir: PRODUCTION_UPLOAD_DIR }),
  );
  expectRejected("a path inside repoRoot/.data", () =>
    assertSafeTestDeletePath(path.join(REPO_ROOT, ".data", "profile-images"), {
      repoRoot: REPO_ROOT,
      productionUploadDir: PRODUCTION_UPLOAD_DIR,
    }),
  );
  expectRejected("the production upload directory itself", () =>
    assertSafeTestDeletePath(PRODUCTION_UPLOAD_DIR, { repoRoot: REPO_ROOT, productionUploadDir: PRODUCTION_UPLOAD_DIR }),
  );
  expectRejected("a path inside the production upload directory", () =>
    assertSafeTestDeletePath(path.join(PRODUCTION_UPLOAD_DIR, "someone-else-real-image.jpg"), {
      repoRoot: REPO_ROOT,
      productionUploadDir: PRODUCTION_UPLOAD_DIR,
    }),
  );
  expectRejected("a plain relative-looking path with no temp-dir ancestry", () => assertSafeTestDeletePath("./some-folder"));
  expectRejected("a path under /home, not a temp dir", () => assertSafeTestDeletePath("/home/someone/data"));

  console.log("== A genuine mktemp-created directory is accepted and removed correctly ==");
  const tempDir = await createIsolatedTestDir("safe-cleanup-canary-");
  const resolved = assertSafeTestDeletePath(tempDir);
  check("mktemp-created dir passes the validator", resolved === path.resolve(tempDir));

  const marker = path.join(tempDir, "marker.txt");
  await import("node:fs/promises").then((fs) => fs.writeFile(marker, "ok"));
  await access(marker);
  await safeRemoveTestDirectory(tempDir);
  let stillExists = true;
  try {
    await access(tempDir);
  } catch {
    stillExists = false;
  }
  check("temp directory is actually removed by safeRemoveTestDirectory", !stillExists);

  console.log("== Removing a temp dir never touches an unrelated real directory ==");
  const productionLikeDir = await createIsolatedTestDir("simulated-production-dir-");
  const sentinelFile = path.join(productionLikeDir, "sentinel.jpg");
  await import("node:fs/promises").then((fs) => fs.writeFile(sentinelFile, "real-upload-content"));

  const unrelatedTempDir = await createIsolatedTestDir("unrelated-test-dir-");
  await safeRemoveTestDirectory(unrelatedTempDir);
  await access(sentinelFile);
  check("an unrelated temp dir's cleanup does not touch a separate real directory", true);
  await safeRemoveTestDirectory(productionLikeDir);

  console.log(`\nAll ${checks} checks passed.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nCANARY FAILED:", error.message);
    console.error(error.stack);
    process.exit(1);
  });
