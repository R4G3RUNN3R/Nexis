import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const resolve = (relative) => path.join(root, relative);
const read = (relative) => fs.readFileSync(resolve(relative), "utf8");
const exists = (relative) => fs.existsSync(resolve(relative));
const bytes = (relative) => fs.statSync(resolve(relative)).size;

function pngDimensions(relative) {
  const buffer = fs.readFileSync(resolve(relative));
  assert.equal(buffer.toString("ascii", 1, 4), "PNG", `${relative} is not a PNG`);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

const tests = [
  ["approved Nexis master mark and favicon exist and remain lightweight", () => {
    assert.ok(exists("public/brand/nexis-mark-128.webp"), "master mark is missing");
    assert.ok(bytes("public/brand/nexis-mark-128.webp") <= 16 * 1024, "master mark is too large");
    assert.ok(exists("public/brand/nexis-favicon-64.png"), "favicon is missing");
    assert.ok(bytes("public/brand/nexis-favicon-64.png") <= 24 * 1024, "favicon is too large");
    assert.deepEqual(pngDimensions("public/brand/nexis-favicon-64.png"), { width: 64, height: 64 });
  }],
  ["shared NexisBrand component owns the master-mark asset path", () => {
    const component = read("src/components/brand/NexisBrand.tsx");
    assert.match(component, /\/brand\/nexis-mark-128\.webp/);
  }],
  ["sidebar branding uses a compact 32px mark without growing the 226px rail", () => {
    const shell = read("src/components/layout/AppShell.tsx");
    const css = read("src/styles/nexis-theme.css");
    assert.match(shell, /<NexisBrand\s+className="sidebar-logo__mark"\s+decorative\s*\/>/);
    assert.match(css, /\.sidebar-logo__mark\s*\{[^}]*width:\s*32px;[^}]*height:\s*32px;/s);
    assert.match(css, /grid-template-columns:\s*226px\s+minmax\(0,\s*1fr\)/);
  }],
  ["public header branding uses the same compact 32px master mark", () => {
    const shell = read("src/components/layout/PublicPageShell.tsx");
    const css = read("src/styles/public-pages.css");
    assert.match(shell, /<NexisBrand\s+className="public-topbar__mark"\s+decorative\s*\/>/);
    assert.match(css, /\.public-topbar__mark\s*\{[^}]*width:\s*32px;[^}]*height:\s*32px;/s);
  }],
  ["authentication screens keep the brand restrained", () => {
    for (const relative of [
      "src/pages/Register.tsx",
      "src/pages/ForgotPassword.tsx",
      "src/pages/ResetPassword.tsx",
      "src/pages/ConfirmEmailChange.tsx",
    ]) {
      const source = read(relative);
      assert.match(source, /<NexisBrand\s+className="register-hero__mark"\s+decorative\s*\/>/);
      assert.match(source, /<NexisBrand\s+className="register-panel__brand"\s+decorative\s*\/>/);
    }
    const css = read("src/styles/register.css");
    assert.match(css, /\.register-hero__mark\s*\{[^}]*width:\s*72px;[^}]*height:\s*72px;/s);
    assert.match(css, /\.register-panel__brand\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;/s);
    assert.match(css, /@media\s*\(min-width:\s*800px\)[\s\S]*?\.register-panel__brand\s*\{\s*display:\s*none;/s);
  }],
  ["public and app shells use the local Nexis mark favicon", () => {
    const index = read("index.html");
    const app = read("app.html");
    assert.match(index, /<link\s+rel="icon"\s+type="image\/png"\s+href="\/brand\/nexis-favicon-64\.png"/i);
    assert.match(app, /<link\s+rel="icon"\s+type="image\/png"\s+href="\/brand\/nexis-favicon-64\.png"/i);
  }],
  ["old V1 does not ship subsystem branding in this patch", () => {
    assert.equal(exists("public/brand/subsystems"), false, "subsystem assets should remain a V2 concern");
  }],
];

let failures = 0;
for (const [name, test] of tests) {
  try { test(); console.log(`PASS ${name}`); }
  catch (error) { failures += 1; console.error(`FAIL ${name}: ${error.message}`); }
}
console.log(`\n${tests.length - failures}/${tests.length} branding regression checks passed`);
if (failures > 0) process.exitCode = 1;
