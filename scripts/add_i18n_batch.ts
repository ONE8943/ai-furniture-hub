/**
 * 海外ブランド製品に i18n + origin フィールドを一括追加するスクリプト
 * npx ts-node scripts/add_i18n_batch.ts
 */
import * as fs from "fs";
import * as path from "path";

const DB_PATH = path.join(__dirname, "..", "shared", "catalog", "products_db.ts");

interface I18nEntry {
  pattern: RegExp;
  name_en: string;
  brand_en: string;
  description_en: string;
  keywords_en: string[];
  country: string;
  original_unit: "mm" | "cm" | "inch";
}

const entries: I18nEntry[] = [
  { pattern: /id: "ikea-kallax-2x2"/, name_en: "KALLAX Shelf unit 2x2", brand_en: "IKEA", description_en: "Versatile 2x2 cube shelf, 77x77cm", keywords_en: ["IKEA KALLAX 2x2", "cube shelf"], country: "SE", original_unit: "cm" },
  { pattern: /id: "ikea-kallax-1x4"/, name_en: "KALLAX Shelf unit 1x4", brand_en: "IKEA", description_en: "Vertical 1x4 cube shelf, 42x147cm", keywords_en: ["IKEA KALLAX 1x4", "vertical shelf"], country: "SE", original_unit: "cm" },
  { pattern: /id: "ikea-kallax-3x4"/, name_en: "KALLAX Shelf unit 3x4", brand_en: "IKEA", description_en: "Large 3x4 cube shelf, 112x147cm", keywords_en: ["IKEA KALLAX 3x4", "large shelf"], country: "SE", original_unit: "cm" },
  { pattern: /id: "ikea-billy-standard"/, name_en: "BILLY Bookcase", brand_en: "IKEA", description_en: "Classic bookcase, 80x28x202cm", keywords_en: ["IKEA BILLY bookcase", "white bookshelf"], country: "SE", original_unit: "cm" },
  { pattern: /id: "ikea-trofast-frame"/, name_en: "TROFAST Storage frame", brand_en: "IKEA", description_en: "Kids storage frame with bins, 99x44x56cm", keywords_en: ["IKEA TROFAST", "kids storage"], country: "SE", original_unit: "cm" },
  { pattern: /id: "ikea-besta-tv-120"/, name_en: "BESTÅ TV unit 120cm", brand_en: "IKEA", description_en: "TV bench with drawers, 120x40x38cm", keywords_en: ["IKEA BESTÅ TV bench", "TV stand"], country: "SE", original_unit: "cm" },
  { pattern: /id: "ikea-besta-tv-180"/, name_en: "BESTÅ TV unit 180cm", brand_en: "IKEA", description_en: "Wide TV bench, 180x40x38cm", keywords_en: ["IKEA BESTÅ 180", "wide TV stand"], country: "SE", original_unit: "cm" },
  { pattern: /id: "dyson-purifier-cool-tp07"/, name_en: "Dyson Purifier Cool TP07", brand_en: "Dyson", description_en: "Air purifier and fan with HEPA+carbon filter", keywords_en: ["Dyson TP07", "air purifier fan"], country: "GB", original_unit: "mm" },
  { pattern: /id: "dyson-supersonic-hd15"/, name_en: "Dyson Supersonic HD15", brand_en: "Dyson", description_en: "Professional hair dryer with intelligent heat control", keywords_en: ["Dyson Supersonic HD15", "hair dryer"], country: "GB", original_unit: "mm" },
  { pattern: /id: "irobot-roomba-i5"/, name_en: "iRobot Roomba i5", brand_en: "iRobot", description_en: "Wi-Fi robot vacuum with smart mapping", keywords_en: ["Roomba i5", "robot vacuum"], country: "US", original_unit: "inch" },
  { pattern: /id: "ecovacs-deebot-t20"/, name_en: "ECOVACS DEEBOT T20 OMNI", brand_en: "ECOVACS", description_en: "Robot vacuum and mop with auto-cleaning station", keywords_en: ["DEEBOT T20", "robot vacuum mop"], country: "CN", original_unit: "mm" },
  { pattern: /id: "amazon-echo-dot-5"/, name_en: "Amazon Echo Dot 5th Gen", brand_en: "Amazon", description_en: "Compact smart speaker with Alexa", keywords_en: ["Echo Dot 5", "Alexa speaker"], country: "US", original_unit: "inch" },
  { pattern: /id: "philips-hue-starter-e26"/, name_en: "Philips Hue Starter Kit E26", brand_en: "Philips", description_en: "Smart LED bulb starter kit with Bridge", keywords_en: ["Philips Hue E26", "smart light"], country: "NL", original_unit: "mm" },
  { pattern: /id: "switchbot-hub-mini"/, name_en: "SwitchBot Hub Mini (Matter)", brand_en: "SwitchBot", description_en: "Smart home hub with Matter support", keywords_en: ["SwitchBot Hub Mini", "Matter hub"], country: "CN", original_unit: "mm" },
  { pattern: /id: "balmuda-the-toaster"/, name_en: "BALMUDA The Toaster", brand_en: "BALMUDA", description_en: "Steam toaster oven with precise temperature control", keywords_en: ["BALMUDA Toaster", "steam oven"], country: "JP", original_unit: "mm" },
];

let content = fs.readFileSync(DB_PATH, "utf-8");
let count = 0;

for (const entry of entries) {
  const match = content.match(entry.pattern);
  if (!match) {
    console.log(`SKIP: ${entry.name_en} (pattern not found)`);
    continue;
  }

  const i18nBlock = `  i18n: { name_en: "${entry.name_en}", brand_en: "${entry.brand_en}", description_en: "${entry.description_en}", search_keywords_en: ${JSON.stringify(entry.keywords_en)} }, origin: { country: "${entry.country}", original_unit: "${entry.original_unit}" },`;

  const idx = content.indexOf(match[0]);
  const afterMatch = content.indexOf("\n", idx);
  const lineEnd = content.indexOf("\n", afterMatch + 1);

  const searchStart = idx;
  let braceDepth = 0;
  let insertPos = -1;
  for (let i = searchStart; i < content.length; i++) {
    if (content[i] === "{") braceDepth++;
    if (content[i] === "}") {
      braceDepth--;
      if (braceDepth === 0) {
        insertPos = i;
        break;
      }
    }
  }

  if (insertPos === -1) {
    console.log(`SKIP: ${entry.name_en} (closing brace not found)`);
    continue;
  }

  if (content.substring(searchStart, insertPos).includes("i18n:")) {
    console.log(`SKIP: ${entry.name_en} (i18n already exists)`);
    continue;
  }

  const prevNewline = content.lastIndexOf("\n", insertPos - 1);
  content = content.substring(0, prevNewline) + "\n" + i18nBlock + content.substring(prevNewline);
  count++;
  console.log(`ADDED: ${entry.name_en}`);
}

fs.writeFileSync(DB_PATH, content, "utf-8");
console.log(`\nDone. Added i18n to ${count} products.`);
