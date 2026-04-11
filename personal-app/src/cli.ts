#!/usr/bin/env node
/**
 * 個人向けホームインベントリ CLI
 *
 * usage:
 *   npx ts-node src/cli.ts room add "リビング" 3600 2700 2400
 *   npx ts-node src/cli.ts room list
 *   npx ts-node src/cli.ts furniture add 1 "Nクリック3段" --model 8841424 --brand ニトリ 419 298 878
 *   npx ts-node src/cli.ts furniture list [room_id]
 *   npx ts-node src/cli.ts consumable add 1 "キャスター" --model 8841518 --months 0
 *   npx ts-node src/cli.ts consumable overdue
 *   npx ts-node src/cli.ts lookup 8841424
 */
import {
  addRoom, listRooms, deleteRoom,
  addFurniture, listFurniture, deleteFurniture,
  addConsumable, listConsumables, getOverdueConsumables,
} from "./db";
import { findProductByModelNumber, KNOWN_PRODUCTS_DB } from "../../shared/catalog/known_products";

const args = process.argv.slice(2);
const [entity, action, ...rest] = args;

function usage(): void {
  console.log(`
Home Inventory CLI

  room add <name> <width_mm> <depth_mm> <height_mm>
  room list
  room delete <id>

  furniture add <room_id> <name> <width_mm> <depth_mm> <height_mm> [--model X] [--brand X] [--price X]
  furniture list [room_id]
  furniture delete <id>

  consumable add <furniture_id> <name> --months <N> [--model X] [--last-replaced YYYY-MM-DD]
  consumable list [furniture_id]
  consumable overdue

  lookup <model_number>  (search shared catalog)
  stats
`);
}

function flag(name: string): string {
  const idx = rest.indexOf(`--${name}`);
  if (idx >= 0 && rest[idx + 1]) return rest[idx + 1]!;
  return "";
}

function numericRest(): number[] {
  return rest.filter((r) => !r.startsWith("--") && !isNaN(Number(r))).map(Number);
}

try {
  switch (entity) {
    case "room": {
      if (action === "add") {
        const name = rest[0]!;
        const nums = numericRest();
        const room = addRoom({ name, width_mm: nums[0]!, depth_mm: nums[1]!, height_mm: nums[2]! });
        console.log("Room added:", room);
      } else if (action === "list") {
        const rooms = listRooms();
        if (rooms.length === 0) console.log("No rooms registered.");
        for (const r of rooms) {
          console.log(`  [${r.id}] ${r.name} - ${r.width_mm}x${r.depth_mm}x${r.height_mm}mm`);
        }
      } else if (action === "delete") {
        deleteRoom(parseInt(rest[0]!));
        console.log("Deleted.");
      } else {
        usage();
      }
      break;
    }

    case "furniture": {
      if (action === "add") {
        const room_id = parseInt(rest[0]!);
        const name = rest[1]!;
        const nums = numericRest().slice(1);
        const model = flag("model");
        const brand = flag("brand");
        const price = flag("price") ? parseInt(flag("price")) : 0;

        let width = nums[0]!, depth = nums[1]!, height = nums[2]!;

        if (model) {
          const known = findProductByModelNumber(model);
          if (known) {
            console.log(`[Catalog] Found: ${known.name} (${known.brand})`);
            if (!width) width = known.outer_width_mm;
            if (!depth) depth = known.outer_depth_mm;
            if (!height) height = known.outer_height_mm;
          }
        }

        const f = addFurniture({ room_id, name, model_number: model, brand, width_mm: width, depth_mm: depth, height_mm: height, price });
        console.log("Furniture added:", f);
      } else if (action === "list") {
        const roomId = rest[0] ? parseInt(rest[0]) : undefined;
        const items = listFurniture(roomId);
        if (items.length === 0) console.log("No furniture registered.");
        for (const f of items) {
          console.log(`  [${f.id}] ${f.name} (${f.brand || "?"}) ${f.width_mm}x${f.depth_mm}x${f.height_mm}mm - Room#${f.room_id}`);
        }
      } else if (action === "delete") {
        deleteFurniture(parseInt(rest[0]!));
        console.log("Deleted.");
      } else {
        usage();
      }
      break;
    }

    case "consumable": {
      if (action === "add") {
        const furniture_id = parseInt(rest[0]!);
        const name = rest[1]!;
        const months = parseInt(flag("months") || "12");
        const model = flag("model");
        const lastReplaced = flag("last-replaced");
        const c = addConsumable({ furniture_id, name, model_number: model, replacement_months: months, last_replaced: lastReplaced });
        console.log("Consumable added:", c);
      } else if (action === "list") {
        const fId = rest[0] ? parseInt(rest[0]) : undefined;
        const items = listConsumables(fId);
        if (items.length === 0) console.log("No consumables registered.");
        for (const c of items) {
          console.log(`  [${c.id}] ${c.name} - replace every ${c.replacement_months}mo (last: ${c.last_replaced || "never"})`);
        }
      } else if (action === "overdue") {
        const overdue = getOverdueConsumables();
        if (overdue.length === 0) {
          console.log("No overdue consumables.");
        } else {
          console.log("Overdue consumables:");
          for (const c of overdue) {
            console.log(`  [!] ${c.name} (${c.furniture_name} in ${c.room_name}) - ${c.days_overdue} days overdue`);
          }
        }
      } else {
        usage();
      }
      break;
    }

    case "lookup": {
      const query = rest[0]!;
      const product = findProductByModelNumber(query);
      if (product) {
        console.log(`Found in catalog (${KNOWN_PRODUCTS_DB.length} products):`);
        console.log(`  ${product.brand} ${product.name}`);
        console.log(`  Model: ${product.model_number}`);
        console.log(`  Outer: ${product.outer_width_mm}x${product.outer_depth_mm}x${product.outer_height_mm}mm`);
        console.log(`  Inner: ${product.inner_width_mm}x${product.inner_depth_mm}x${product.inner_height_per_tier_mm}mm x ${product.tiers} tiers`);
        console.log(`  Price: ¥${product.price_range.min.toLocaleString()} - ¥${product.price_range.max.toLocaleString()}`);
        if (product.compatible_storage.length > 0) {
          console.log("  Compatible storage:");
          for (const s of product.compatible_storage) {
            console.log(`    - ${s.name} (${s.model_number}) x${s.fits_per_tier}/tier`);
          }
        }
      } else {
        console.log(`Model "${query}" not found in catalog.`);
      }
      break;
    }

    case "stats": {
      const rooms = listRooms();
      const furniture = listFurniture();
      const consumables = listConsumables();
      console.log(`Rooms: ${rooms.length} | Furniture: ${furniture.length} | Consumables: ${consumables.length}`);
      console.log(`Shared catalog: ${KNOWN_PRODUCTS_DB.length} products`);
      break;
    }

    default:
      usage();
  }
} catch (e) {
  console.error("Error:", e instanceof Error ? e.message : e);
  process.exit(1);
}
