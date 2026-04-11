import { RoomPreset } from "./types";

export const ROOM_PRESETS: RoomPreset[] = [
  {
    id: "preset-6j-study",
    title: "6畳一人暮らし書斎",
    scene: "書斎・デスク",
    target_persona: "在宅ワーカー・一人暮らし",
    budget_total_yen: 50000,
    product_ids: [
      "nitori-desk-n-click-120",
      "panasonic-led-desk-sq-ld560",
      "nitori-nclick-regular-3",
      "desk-mat-pu-leather-80x40",
      "cable-cover-floor-2m-white",
    ],
    extra_items: [
      {
        name: "オフィスチェア（メッシュ）",
        search_keywords: ["オフィスチェア メッシュ", "デスクチェア 腰痛"],
        price_range: { min: 8000, max: 20000 },
        role: "デスクチェア",
      },
      {
        name: "電源タップ（USB付き）",
        search_keywords: ["電源タップ USB", "OAタップ 6口"],
        price_range: { min: 1500, max: 3000 },
        role: "電源管理",
      },
    ],
    layout_tip: "デスクは窓際に配置して自然光を活用。背面にNクリックを置いて書類・小物を整理。壁際にケーブルモールを這わせると見た目がすっきり。",
  },
  {
    id: "preset-2ldk-family-living",
    title: "2LDKファミリーリビング",
    scene: "リビング",
    target_persona: "ファミリー・持ち家",
    budget_total_yen: 150000,
    product_ids: [
      "nitori-tv-board-colln-180",
      "ikea-kallax-3x4",
      "nitori-dining-table-align-135",
      "nitori-dining-chair-relax",
      "iris-led-ceiling-cls8d",
      "nihon-ikuji-gate-roll-130",
      "joint-mat-large-60cm-9set",
    ],
    extra_items: [
      {
        name: "ラグ（洗えるタイプ）",
        search_keywords: ["洗えるラグ 200x250", "ウォッシャブル ラグ"],
        price_range: { min: 5000, max: 15000 },
        role: "床保護・快適性",
      },
    ],
    layout_tip: "KALLAXは壁面収納として配置。おもちゃ・本・ファイルを入れ替え可能なインサートで整理。ダイニングテーブルはリビングとの境界に置いてゾーニング。ベビーゲートはキッチン入口に設置。",
  },
  {
    id: "preset-kitchen-gap",
    title: "キッチン隙間収納コンパクト",
    scene: "キッチン",
    target_persona: "一人暮らし・賃貸",
    budget_total_yen: 10000,
    product_ids: [
      "nitori-kitchen-wagon-slim-w20",
      "tower-magnet-fridge-side",
      "tower-range-top-rack",
      "nitori-spice-rack-slim",
    ],
    extra_items: [
      {
        name: "突っ張りキッチンラック",
        search_keywords: ["突っ張り キッチン棚", "キッチン 突っ張りラック"],
        price_range: { min: 3000, max: 8000 },
        role: "上部空間活用",
      },
    ],
    layout_tip: "冷蔵庫横にスリムワゴン(幅20cm)を差し込む。冷蔵庫側面にマグネット式ラックでラップ・アルミホイルを収納。レンジ上ラックで電子レンジ上のデッドスペースを活用。",
  },
];
