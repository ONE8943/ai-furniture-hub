/**
 * 参照物DB
 *
 * 写真内に写っている既知サイズの物体から、
 * 対象物の実寸をピクセル比率で逆算するためのマスターデータ。
 *
 * 全寸法は mm 単位。
 */

export interface ReferenceObject {
  id: string;
  names: string[];
  width_mm: number;
  height_mm: number;
  depth_mm?: number;
  note: string;
}

export const REFERENCE_OBJECTS: ReferenceObject[] = [
  {
    id: "business_card_jp",
    names: ["名刺", "めいし", "business card"],
    width_mm: 91,
    height_mm: 55,
    note: "日本標準サイズ（4号）",
  },
  {
    id: "credit_card",
    names: ["クレジットカード", "カード", "ICカード", "suica", "pasmo", "credit card"],
    width_mm: 85.6,
    height_mm: 53.98,
    note: "ISO/IEC 7810 ID-1",
  },
  {
    id: "pet_bottle_500",
    names: ["ペットボトル", "500mlペットボトル", "pet bottle"],
    width_mm: 65,
    height_mm: 205,
    note: "500ml 標準（直径約65mm）",
  },
  {
    id: "pet_bottle_2l",
    names: ["2lペットボトル", "2リットル"],
    width_mm: 105,
    height_mm: 310,
    note: "2L 標準（直径約105mm）",
  },
  {
    id: "a4_paper",
    names: ["a4", "A4用紙", "A4", "a4用紙", "コピー用紙"],
    width_mm: 210,
    height_mm: 297,
    note: "ISO 216 A4",
  },
  {
    id: "a3_paper",
    names: ["a3", "A3用紙", "A3"],
    width_mm: 297,
    height_mm: 420,
    note: "ISO 216 A3",
  },
  {
    id: "1yen_coin",
    names: ["1円玉", "1円硬貨", "一円玉"],
    width_mm: 20,
    height_mm: 20,
    note: "直径20mm",
  },
  {
    id: "500yen_coin",
    names: ["500円玉", "500円硬貨", "五百円玉"],
    width_mm: 26.5,
    height_mm: 26.5,
    note: "直径26.5mm",
  },
  {
    id: "smartphone_std",
    names: ["スマホ", "スマートフォン", "iphone", "iPhone"],
    width_mm: 71.5,
    height_mm: 147,
    note: "iPhone 15 相当（標準サイズの目安）",
  },
  {
    id: "ruler_30cm",
    names: ["定規", "30cm定規", "ものさし"],
    width_mm: 300,
    height_mm: 30,
    note: "30cm定規（最も正確）",
  },
  {
    id: "tissue_box",
    names: ["ティッシュ箱", "ティッシュボックス", "tissue box"],
    width_mm: 240,
    height_mm: 115,
    depth_mm: 90,
    note: "標準ティッシュペーパー箱",
  },
  {
    id: "can_350",
    names: ["350ml缶", "缶ビール", "缶"],
    width_mm: 66,
    height_mm: 122,
    note: "350ml 標準缶",
  },
  {
    id: "magazine_b5",
    names: ["雑誌", "B5雑誌", "コミック"],
    width_mm: 182,
    height_mm: 257,
    note: "B5判（一般的な雑誌サイズ）",
  },
  {
    id: "ballpen",
    names: ["ボールペン", "ペン", "pen"],
    width_mm: 10,
    height_mm: 140,
    note: "標準ボールペン（約14cm）",
  },
];

export function findReferenceObject(text: string): ReferenceObject | null {
  const norm = text.normalize("NFKC").toLowerCase();
  for (const ref of REFERENCE_OBJECTS) {
    for (const name of ref.names) {
      if (norm.includes(name.toLowerCase())) return ref;
    }
  }
  return null;
}

export function listReferenceNames(): string[] {
  return REFERENCE_OBJECTS.map((r) => r.names[0]!);
}
