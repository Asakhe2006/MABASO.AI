import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDirectory, "..");
const configSource = await readFile(path.join(frontendRoot, "src", "sitePageConfig.js"), "utf8");
const publicRoutes = new Set(["/"]);

// Main page declarations use a four-space `route` key. Nested CTA/link route
// values use deeper indentation or sit inline, so splitting at main route keys
// avoids both nested-object regex truncation and false link entries.
const routeDeclarations = [...configSource.matchAll(/^ {4}route:\s*"([^"]+)"/gm)];
for (let index = 0; index < routeDeclarations.length; index += 1) {
  const declaration = routeDeclarations[index];
  const route = declaration[1] || "";
  const segmentEnd = routeDeclarations[index + 1]?.index ?? configSource.length;
  const segment = configSource.slice(declaration.index, segmentEnd);
  const access = segment.match(/^ {4}access:\s*"([^"]+)"/m)?.[1] || "";
  if (route.startsWith("/") && access === "public" && !route.startsWith("/app/") && !route.startsWith("/admin")) {
    publicRoutes.add(route);
  }
}

const today = new Date().toISOString().slice(0, 10);
const origin = "https://mabaso-ai-web.onrender.com";
const entries = [...publicRoutes]
  .sort((left, right) => left.localeCompare(right))
  .map((route) => `  <url>\n    <loc>${origin}${route}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${route === "/" ? "1.0" : "0.7"}</priority>\n  </url>`)
  .join("\n");

await writeFile(
  path.join(frontendRoot, "public", "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`,
  "utf8",
);

console.log(`Generated sitemap with ${publicRoutes.size} public routes.`);
