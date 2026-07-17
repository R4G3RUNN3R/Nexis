import { mkdir, mkdtemp, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DATABASE_URL, PROFILE_IMAGE_STORAGE_DIR } from "../config/env.js";

let resolvedDir = null;
let resolutionError = null;
let resolutionPromise = null;

async function verifyWritable(dir) {
  const probePath = path.join(dir, `.write-check-${process.pid}-${Date.now()}`);
  await writeFile(probePath, "ok");
  await unlink(probePath);
}

async function resolveDirOnce() {
  if (PROFILE_IMAGE_STORAGE_DIR) {
    await mkdir(PROFILE_IMAGE_STORAGE_DIR, { recursive: true });
    await verifyWritable(PROFILE_IMAGE_STORAGE_DIR);
    return PROFILE_IMAGE_STORAGE_DIR;
  }

  if (DATABASE_URL) {
    // A real production database is configured but no durable storage
    // directory was given. Refusing to silently fall back to a path inside
    // the source checkout is deliberate - that exact fallback caused a live
    // data-loss incident (see docs/incident-profile-image-data-loss-20260717.md)
    // when disposable test cleanup and persistent uploads shared a directory.
    throw new Error(
      "PROFILE_IMAGE_STORAGE_DIR is not set while a production database is configured. " +
        "Refusing to store uploads inside the source checkout - set PROFILE_IMAGE_STORAGE_DIR " +
        "to a durable directory outside the repository.",
    );
  }

  // No real database configured - isolated/test mode. Always a fresh,
  // uniquely-named OS temp directory, never anything inside the repository
  // or its .data folder, so an isolated test run can never touch production
  // uploads even if one happens to be reachable from this machine.
  return mkdtemp(path.join(os.tmpdir(), "nexis-profile-images-"));
}

// Call once at startup. Safe to call multiple times - resolves once and
// caches the result (or the failure) for isProfileImageUploadAvailable().
export async function ensureProfileImageStorageReady() {
  if (resolutionPromise) return resolutionPromise;
  resolutionPromise = resolveDirOnce()
    .then((dir) => {
      resolvedDir = dir;
      return dir;
    })
    .catch((error) => {
      resolutionError = error instanceof Error ? error : new Error(String(error));
      throw resolutionError;
    });
  return resolutionPromise;
}

export function isProfileImageUploadAvailable() {
  return Boolean(resolvedDir) && !resolutionError;
}

export function getProfileImageStorageError() {
  return resolutionError;
}

export function getProfileImageDir() {
  if (!resolvedDir) {
    throw new Error("Profile image storage has not been initialized. Call ensureProfileImageStorageReady() at startup.");
  }
  return resolvedDir;
}

// Test-only escape hatch so canaries can re-exercise resolution logic
// (e.g. "production mode without PROFILE_IMAGE_STORAGE_DIR fails safely")
// without restarting the process. Production code never calls this.
export function __resetProfileImageStorageForTests() {
  resolvedDir = null;
  resolutionError = null;
  resolutionPromise = null;
}
