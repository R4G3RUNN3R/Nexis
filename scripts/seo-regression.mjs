import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const exists = (relative) => fs.existsSync(path.join(root, relative));

const tests = [
  ["public homepage contains substantial semantic fallback content", () => {
    const html = read("index.html");
    const match = html.match(/<!-- NEXIS_PUBLIC_FALLBACK_START -->([\s\S]*?)<!-- NEXIS_PUBLIC_FALLBACK_END -->/);
    assert.ok(match, "public fallback markers are missing");
    assert.match(match[1], /<main\b/i, "public fallback must use a <main> landmark");
    assert.match(match[1], /<h1\b/i, "public fallback must contain an <h1>");
    const text = match[1].replace(/<[^>]+>/g, " ").replace(/&[^;]+;/g, " ").replace(/\s+/g, " ").trim();
    const words = text.split(" ").filter(Boolean);
    assert.ok(words.length >= 180, `public fallback is too thin: ${words.length} words`);
  }],
  ["public homepage is indexable and self-canonical", () => {
    const html = read("index.html");
    assert.match(html, /<meta\s+name="robots"\s+content="index, follow, max-image-preview:large"\s*\/?>/i);
    assert.match(html, /<link\s+rel="canonical"\s+href="https:\/\/nexis\.nexus\/"\s*\/?>/i);
  }],
  ["application shell exists and is explicitly noindex", () => {
    assert.ok(exists("app.html"), "app.html is missing");
    const html = read("app.html");
    assert.match(html, /<meta\s+name="robots"\s+content="noindex, nofollow, noarchive"\s*\/?>/i);
    assert.doesNotMatch(html, /rel="canonical"/i, "application shell must not advertise a canonical URL");
  }],
  ["public and application shells boot the same React entrypoint", () => {
    const index = read("index.html");
    const app = read("app.html");
    assert.match(index, /<script\s+type="module"\s+src="\/src\/main\.tsx"><\/script>/i);
    assert.match(app, /<script\s+type="module"\s+src="\/src\/main\.tsx"><\/script>/i);
  }],
  ["homepage uses a local static favicon", () => {
    const html = read("index.html");
    assert.match(html, /<link\s+rel="icon"[^>]+href="\/favicon\.svg"/i);
    assert.ok(exists("public/favicon.svg"), "public/favicon.svg is missing");
  }],
  ["TypeScript Vite config is the sole config authority", () => {
    assert.ok(exists("vite.config.ts"), "vite.config.ts is missing");
    assert.equal(exists("vite.config.js"), false, "generated vite.config.js must not exist");
    assert.equal(exists("vite.config.d.ts"), false, "generated vite.config.d.ts must not exist");
    const tsconfig = JSON.parse(read("tsconfig.node.json"));
    assert.equal(tsconfig.compilerOptions?.noEmit, true, "tsconfig.node.json must prevent generated Vite config artifacts");
  }],
  ["Vite build declares both public and application HTML inputs", () => {
    const config = read("vite.config.ts");
    assert.match(config, /rollupOptions\s*:/, "Vite build.rollupOptions is missing");
    assert.match(config, /index\.html/, "public index.html input is missing");
    assert.match(config, /app\.html/, "application app.html input is missing");
  }],
  ["crawler policy exposes only the public root sitemap URL", () => {
    const sitemap = read("public/sitemap.xml");
    const locs = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
    assert.deepEqual(locs, ["https://nexis.nexus/"]);
    const robots = read("public/robots.txt");
    assert.match(robots, /Sitemap:\s*https:\/\/nexis\.nexus\/sitemap\.xml/i);
  }],
];

let failures = 0;
for (const [name, test] of tests) {
  try {
    test();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

console.log(`\n${tests.length - failures}/${tests.length} SEO regression checks passed`);
if (failures > 0) process.exitCode = 1;
