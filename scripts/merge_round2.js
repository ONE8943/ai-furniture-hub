const fs = require("fs");
const path = require("path");

const JSONL_FILES = [
  "staging/expand/agent_f.jsonl",
  "staging/expand/agent_g.jsonl",
  "staging/expand/agent_h.jsonl",
  "staging/expand/agent_i.jsonl",
  "staging/expand/agent_j.jsonl",
];

const CATALOG = "shared/catalog/known_products.ts";
const ROOT = path.resolve(__dirname, "..");

function readJsonlFiles() {
  const products = [];
  for (const rel of JSONL_FILES) {
    const abs = path.join(ROOT, rel);
    const lines = fs.readFileSync(abs, "utf-8").split("\n").filter(Boolean);
    for (const line of lines) {
      products.push(JSON.parse(line));
    }
  }
  return products;
}

function escapeStr(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function formatRelatedItem(ri) {
  const skw = ri.search_keywords.map((k) => `"${escapeStr(k)}"`).join(", ");
  return (
    `      { relation: "${ri.relation}", name: "${escapeStr(ri.name)}", ` +
    `category: "${escapeStr(ri.category)}", ` +
    `why: "${escapeStr(ri.why)}", ` +
    `search_keywords: [${skw}], ` +
    `price_range: { min: ${ri.price_range.min}, max: ${ri.price_range.max} }, ` +
    `required: ${ri.required} }`
  );
}

function productToTs(p) {
  const dim = p.dimensions_mm;
  const colors = p.colors.map((c) => `"${escapeStr(c)}"`).join(", ");
  const urlExpr =
    `"https://search.rakuten.co.jp/search/mall/" + encodeURIComponent("${escapeStr(p.brand)} ${escapeStr(p.name)}") + "/"`;

  const riLines = (p.related_items || []).map((ri) => formatRelatedItem(ri));

  const lines = [
    `  {`,
    `    id: "${escapeStr(p.id)}",`,
    `    brand: "${escapeStr(p.brand)}",`,
    `    series: "",`,
    `    model_number: "",`,
    `    name: "${escapeStr(p.name)}",`,
    `    outer_width_mm: ${dim.width},`,
    `    outer_height_mm: ${dim.height},`,
    `    outer_depth_mm: ${dim.depth},`,
    `    inner_width_mm: 0,`,
    `    inner_height_per_tier_mm: 0,`,
    `    inner_depth_mm: 0,`,
    `    tiers: 0,`,
    `    price_range: { min: ${p.price_jpy}, max: ${p.price_jpy} },`,
    `    colors: [${colors}],`,
    `    material: "",`,
    `    weight_kg: 0,`,
    `    load_capacity_per_tier_kg: 0,`,
    `    visual_features: [],`,
    `    consumables: [],`,
    `    compatible_storage: [],`,
    `    url_template: ${urlExpr},`,
    `    category: "${escapeStr(p.category)}" as ProductCategory,`,
    `    related_items: [`,
    riLines.join(",\n"),
    `    ],`,
    `  },`,
  ];
  return lines.join("\n");
}

function main() {
  const products = readJsonlFiles();
  console.log(`Read ${products.length} products from ${JSONL_FILES.length} JSONL files`);

  const catalogPath = path.join(ROOT, CATALOG);
  const src = fs.readFileSync(catalogPath, "utf-8");

  const marker = /^];$/m;
  const idx = src.search(marker);
  if (idx === -1) {
    console.error("ERROR: Could not find closing ]; in catalog file");
    process.exit(1);
  }

  const before = src.slice(0, idx);
  const after = src.slice(idx);

  const newEntries = products.map((p) => productToTs(p)).join("\n");
  const updated = before + newEntries + "\n" + after;

  fs.writeFileSync(catalogPath, updated, "utf-8");

  const count = (updated.match(/^\s{2}\{$/gm) || []).length;
  console.log(`Done. Total top-level entries (approx): ${count}`);
  console.log(`Inserted ${products.length} new products before ];`);
}

main();
