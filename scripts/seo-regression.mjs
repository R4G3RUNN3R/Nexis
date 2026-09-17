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
    for (const route of ["/news", "/rules", "/staff", "/contact", "/credits"]) {
      assert.match(match[1], new RegExp(`href=["']${route}["']`, "i"), `homepage fallback must link to ${route}`);
    }
  }],
  ["public homepage is indexable and self-canonical", () => {
    const html = read("index.html");
    assert.match(html, /<meta\s+name="robots"\s+content="index, follow, max-image-preview:large"\s*\/?>/i);
    assert.match(html, /<link\s+rel="canonical"\s+href="https:\/\/nexis\.nexus\/"\s*\/?>/i);
  }],
  ["public homepage publisher schema includes the Voidsmith logo", () => {
    const html = read("index.html");
    const scripts = [...html.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
    assert.ok(scripts.length > 0, "homepage JSON-LD is missing");
    const schema = JSON.parse(scripts[0][1]);
    assert.equal(schema.publisher?.logo, "https://voidsmithindustries.com/assets/images/logo.png");
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
  ["homepage uses the local Nexis master-mark favicon", () => {
    const html = read("index.html");
    assert.match(html, /<link\s+rel="icon"\s+type="image\/png"\s+href="\/brand\/nexis-favicon-64\.png"/i);
    assert.ok(exists("public/brand/nexis-favicon-64.png"), "public/brand/nexis-favicon-64.png is missing");
  }],
  ["TypeScript Vite config is the sole config authority", () => {
    assert.ok(exists("vite.config.ts"), "vite.config.ts is missing");
    assert.equal(exists("vite.config.js"), false, "generated vite.config.js must not exist");
    assert.equal(exists("vite.config.d.ts"), false, "generated vite.config.d.ts must not exist");
    const tsconfig = JSON.parse(read("tsconfig.node.json"));
    assert.equal(tsconfig.compilerOptions?.noEmit, true, "tsconfig.node.json must prevent generated Vite config artifacts");
  }],
  ["Vite build declares public route HTML entries and the private application shell", () => {
    const config = read("vite.config.ts");
    assert.match(config, /rollupOptions\s*:/, "Vite build.rollupOptions is missing");
    for (const file of ["index.html", "news.html", "rules.html", "staff.html", "contact.html", "credits.html", "app.html"]) {
      assert.match(config, new RegExp(file.replace(".", "\.")), `${file} input is missing`);
    }
  }],
  ["every sitemap route has a dedicated crawlable HTML document", () => {
    const pages = [
      ["news", "Nexis News", "https://nexis.nexus/news"],
      ["rules", "Nexis Rules", "https://nexis.nexus/rules"],
      ["staff", "Nexis Staff", "https://nexis.nexus/staff"],
      ["contact", "Contact Nexis", "https://nexis.nexus/contact"],
      ["credits", "Nexis Credits", "https://nexis.nexus/credits"],
    ];
    for (const [slug, titleFragment, canonical] of pages) {
      const file = `${slug}.html`;
      assert.ok(exists(file), `${file} is missing`);
      const html = read(file);
      assert.match(html, /<meta\s+name="robots"\s+content="index, follow, max-image-preview:large"\s*\/?>/i, `${file} must be indexable`);
      assert.match(html, new RegExp(`<link\s+rel="canonical"\s+href="${canonical.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\s*\/?>`, "i"), `${file} must self-canonicalize`);
      assert.match(html, new RegExp(`<title>[^<]*${titleFragment}`, "i"), `${file} needs a route-specific title`);
      assert.match(html, /<main\b/i, `${file} needs semantic fallback content`);
      assert.match(html, /<h1\b/i, `${file} needs an h1`);
      assert.match(html, /href="https:\/\/voidsmithindustries\.com\/"/i, `${file} needs crawlable Voidsmith attribution`);
      assert.match(html, /<script\s+type="module"\s+src="\/src\/main\.tsx"><\/script>/i, `${file} must boot the React application`);
      const text = html.match(/<main\b[\s\S]*?<\/main>/i)?.[0].replace(/<[^>]+>/g, " ").replace(/&[^;]+;/g, " ").replace(/\s+/g, " ").trim() ?? "";
      assert.ok(text.split(" ").filter(Boolean).length >= 55, `${file} fallback content is too thin`);
    }
  }],
  ["versioned nginx mapping serves clean public URLs from their dedicated HTML documents", () => {
    assert.ok(exists("ops/nginx/nexis-public-routes.conf"), "versioned public-route nginx snippet is missing");
    const nginx = read("ops/nginx/nexis-public-routes.conf");
    for (const slug of ["news", "rules", "staff", "contact", "credits"]) {
      assert.match(nginx, new RegExp(`location\s*=\s*/${slug}\s*\{[\s\S]*?try_files\s+/${slug}\.html\s+=404;[\s\S]*?\}`, "i"), `/${slug} is not mapped to ${slug}.html`);
    }
  }],
  ["crawler policy exposes the intentional public information surface", () => {
    const sitemap = read("public/sitemap.xml");
    const locs = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
    assert.deepEqual(locs, [
      "https://nexis.nexus/",
      "https://nexis.nexus/news",
      "https://nexis.nexus/rules",
      "https://nexis.nexus/staff",
      "https://nexis.nexus/contact",
      "https://nexis.nexus/credits",
    ]);
    for (const loc of locs) {
      assert.doesNotMatch(loc, /\/(login|register|app|profile)(?:$|[/?#])/i, "private application route leaked into sitemap");
    }
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
