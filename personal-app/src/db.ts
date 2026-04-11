import Database from "better-sqlite3";
import { join } from "path";
import { z } from "zod";

const DB_PATH = join(__dirname, "..", "data", "inventory.db");

export const RoomSchema = z.object({
  name: z.string().min(1),
  width_mm: z.number().int().positive(),
  depth_mm: z.number().int().positive(),
  height_mm: z.number().int().positive(),
  notes: z.string().optional().default(""),
});
export type Room = z.infer<typeof RoomSchema> & { id: number; created_at: string };

export const FurnitureSchema = z.object({
  room_id: z.number().int().positive(),
  name: z.string().min(1),
  model_number: z.string().optional().default(""),
  brand: z.string().optional().default(""),
  width_mm: z.number().int().positive(),
  depth_mm: z.number().int().positive(),
  height_mm: z.number().int().positive(),
  price: z.number().int().nonnegative().optional().default(0),
  purchase_date: z.string().optional().default(""),
  notes: z.string().optional().default(""),
});
export type Furniture = z.infer<typeof FurnitureSchema> & { id: number; created_at: string };

export const ConsumableSchema = z.object({
  furniture_id: z.number().int().positive(),
  name: z.string().min(1),
  model_number: z.string().optional().default(""),
  replacement_months: z.number().int().positive(),
  last_replaced: z.string().optional().default(""),
  notes: z.string().optional().default(""),
});
export type Consumable = z.infer<typeof ConsumableSchema> & { id: number; created_at: string };

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    const { mkdirSync } = require("fs");
    mkdirSync(join(__dirname, "..", "data"), { recursive: true });
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      width_mm INTEGER NOT NULL,
      depth_mm INTEGER NOT NULL,
      height_mm INTEGER NOT NULL,
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS furniture (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL REFERENCES rooms(id),
      name TEXT NOT NULL,
      model_number TEXT DEFAULT '',
      brand TEXT DEFAULT '',
      width_mm INTEGER NOT NULL,
      depth_mm INTEGER NOT NULL,
      height_mm INTEGER NOT NULL,
      price INTEGER DEFAULT 0,
      purchase_date TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS consumables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      furniture_id INTEGER NOT NULL REFERENCES furniture(id),
      name TEXT NOT NULL,
      model_number TEXT DEFAULT '',
      replacement_months INTEGER NOT NULL,
      last_replaced TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

// -- Room CRUD --

export function addRoom(input: z.infer<typeof RoomSchema>): Room {
  const data = RoomSchema.parse(input);
  const db = getDb();
  const stmt = db.prepare(
    "INSERT INTO rooms (name, width_mm, depth_mm, height_mm, notes) VALUES (?, ?, ?, ?, ?)"
  );
  const info = stmt.run(data.name, data.width_mm, data.depth_mm, data.height_mm, data.notes);
  return db.prepare("SELECT * FROM rooms WHERE id = ?").get(info.lastInsertRowid) as Room;
}

export function listRooms(): Room[] {
  return getDb().prepare("SELECT * FROM rooms ORDER BY name").all() as Room[];
}

export function getRoom(id: number): Room | undefined {
  return getDb().prepare("SELECT * FROM rooms WHERE id = ?").get(id) as Room | undefined;
}

export function deleteRoom(id: number): boolean {
  const db = getDb();
  db.prepare("DELETE FROM consumables WHERE furniture_id IN (SELECT id FROM furniture WHERE room_id = ?)").run(id);
  db.prepare("DELETE FROM furniture WHERE room_id = ?").run(id);
  const result = db.prepare("DELETE FROM rooms WHERE id = ?").run(id);
  return result.changes > 0;
}

// -- Furniture CRUD --

export function addFurniture(input: z.infer<typeof FurnitureSchema>): Furniture {
  const data = FurnitureSchema.parse(input);
  const db = getDb();
  const stmt = db.prepare(
    "INSERT INTO furniture (room_id, name, model_number, brand, width_mm, depth_mm, height_mm, price, purchase_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );
  const info = stmt.run(
    data.room_id, data.name, data.model_number, data.brand,
    data.width_mm, data.depth_mm, data.height_mm,
    data.price, data.purchase_date, data.notes,
  );
  return db.prepare("SELECT * FROM furniture WHERE id = ?").get(info.lastInsertRowid) as Furniture;
}

export function listFurniture(roomId?: number): Furniture[] {
  const db = getDb();
  if (roomId) {
    return db.prepare("SELECT * FROM furniture WHERE room_id = ? ORDER BY name").all(roomId) as Furniture[];
  }
  return db.prepare("SELECT * FROM furniture ORDER BY room_id, name").all() as Furniture[];
}

export function deleteFurniture(id: number): boolean {
  const db = getDb();
  db.prepare("DELETE FROM consumables WHERE furniture_id = ?").run(id);
  const result = db.prepare("DELETE FROM furniture WHERE id = ?").run(id);
  return result.changes > 0;
}

// -- Consumable CRUD --

export function addConsumable(input: z.infer<typeof ConsumableSchema>): Consumable {
  const data = ConsumableSchema.parse(input);
  const db = getDb();
  const stmt = db.prepare(
    "INSERT INTO consumables (furniture_id, name, model_number, replacement_months, last_replaced, notes) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const info = stmt.run(
    data.furniture_id, data.name, data.model_number,
    data.replacement_months, data.last_replaced, data.notes,
  );
  return db.prepare("SELECT * FROM consumables WHERE id = ?").get(info.lastInsertRowid) as Consumable;
}

export function listConsumables(furnitureId?: number): Consumable[] {
  const db = getDb();
  if (furnitureId) {
    return db.prepare("SELECT * FROM consumables WHERE furniture_id = ? ORDER BY name").all(furnitureId) as Consumable[];
  }
  return db.prepare("SELECT * FROM consumables ORDER BY furniture_id, name").all() as Consumable[];
}

export function getOverdueConsumables(): Array<Consumable & { furniture_name: string; room_name: string; days_overdue: number }> {
  const db = getDb();
  const all = db.prepare(`
    SELECT c.*, f.name as furniture_name, r.name as room_name
    FROM consumables c
    JOIN furniture f ON c.furniture_id = f.id
    JOIN rooms r ON f.room_id = r.id
    WHERE c.last_replaced != ''
    ORDER BY c.last_replaced
  `).all() as Array<Consumable & { furniture_name: string; room_name: string }>;

  const now = Date.now();
  return all
    .map((c) => {
      const lastDate = new Date(c.last_replaced).getTime();
      const dueDate = lastDate + c.replacement_months * 30 * 86_400_000;
      const days_overdue = Math.floor((now - dueDate) / 86_400_000);
      return { ...c, days_overdue };
    })
    .filter((c) => c.days_overdue > 0)
    .sort((a, b) => b.days_overdue - a.days_overdue);
}
