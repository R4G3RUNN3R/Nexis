// Defensive guard against the exact mistake that caused
// docs/incident-profile-image-data-loss-20260717.md: isolated test cleanup
// ran `rm -rf .data` directly in the production checkout, deleting real
// uploaded player images that happened to share a parent directory with the
// disposable pglite test database.
//
// Going forward, any test/canary cleanup that needs to recursively delete a
// directory must route through safeRemoveTestDirectory(), which refuses to
// touch anything that isn't a path this module itself created via mkdtemp.
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export class UnsafeDeletePathError extends Error {}

const FORBIDDEN_EXACT_PATHS = ["/", "/srv", "/root", "/home", "/etc", "/usr", "/var", "/bin", "/sbin", "/lib"];

// Throws UnsafeDeletePathError for any path that is not safe to recursively
// delete as test cleanup. Returns the resolved absolute path when safe.
export function assertSafeTestDeletePath(targetPath, { repoRoot, productionUploadDir } = {}) {
  if (typeof targetPath !== "string" || !targetPath.trim()) {
    throw new UnsafeDeletePathError("Refusing to delete: path is empty or unresolved.");
  }

  const resolved = path.resolve(targetPath);

  for (const forbidden of FORBIDDEN_EXACT_PATHS) {
    if (resolved === forbidden) {
      throw new UnsafeDeletePathError(`Refusing to delete protected system path: ${resolved}`);
    }
  }

  if (repoRoot) {
    const resolvedRepoRoot = path.resolve(repoRoot);
    if (resolved === resolvedRepoRoot) {
      throw new UnsafeDeletePathError(`Refusing to delete the repository root: ${resolved}`);
    }
    if (resolved === path.join(resolvedRepoRoot, ".data") || resolved.startsWith(path.join(resolvedRepoRoot, ".data") + path.sep)) {
      throw new UnsafeDeletePathError(
        `Refusing to delete inside the shared .data directory: ${resolved}. Use an isolated temp directory created by createIsolatedTestDir() instead.`,
      );
    }
  }

  if (productionUploadDir) {
    const resolvedUploadDir = path.resolve(productionUploadDir);
    if (resolved === resolvedUploadDir || resolved.startsWith(resolvedUploadDir + path.sep)) {
      throw new UnsafeDeletePathError(`Refusing to delete the production upload directory or a path inside it: ${resolved}`);
    }
  }

  const tmpRoot = path.resolve(os.tmpdir());
  if (resolved !== tmpRoot && !resolved.startsWith(tmpRoot + path.sep)) {
    throw new UnsafeDeletePathError(
      `Refusing to delete: ${resolved} is not inside the OS temp directory (${tmpRoot}). Isolated test storage must be created with createIsolatedTestDir() (mkdtemp), never an ad hoc path.`,
    );
  }

  return resolved;
}

export async function safeRemoveTestDirectory(targetPath, options = {}) {
  const resolved = assertSafeTestDeletePath(targetPath, options);
  await rm(resolved, { recursive: true, force: true });
  return resolved;
}

// Creates a uniquely-named directory under the OS temp dir - the only kind
// of path assertSafeTestDeletePath() will ever accept for deletion.
export async function createIsolatedTestDir(prefix = "nexis-test-") {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}
