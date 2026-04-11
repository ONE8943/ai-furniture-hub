/**
 * キュレーション系の型定義
 *
 * ルームプリセット / バンドル / インフルエンサーPick / ハックセット
 */

export interface RoomPreset {
  id: string;
  title: string;
  scene: string;
  target_persona: string;
  budget_total_yen: number;
  product_ids: string[];
  extra_items: Array<{
    name: string;
    search_keywords: string[];
    price_range: { min: number; max: number };
    role: string;
  }>;
  layout_tip: string;
  photo_source?: string;
}

export interface CuratedBundle {
  id: string;
  title: string;
  description: string;
  occasion: string;
  product_ids: string[];
  total_price_yen: number;
  savings_hint?: string;
  seasonal?: boolean;
  available_months?: number[];
}

export type CuratorType =
  | "YouTuber" | "ブロガー" | "整理収納アドバイザー"
  | "インテリアコーディネーター" | "雑誌編集部" | "専門家";

export type SourcePlatform = "youtube" | "blog" | "instagram" | "magazine" | "tv";

export interface InfluencerPick {
  id: string;
  curator_name: string;
  curator_type: CuratorType;
  curator_credential?: string;
  title: string;
  product_ids: string[];
  why_picked: string;
  source_url?: string;
  source_platform: SourcePlatform;
  published_date?: string;
  view_count_hint?: string;
}

export interface HackSet {
  id: string;
  title: string;
  target_product_ids: string[];
  items: Array<{
    name: string;
    price_yen: number;
    where_to_buy: string;
    role: string;
  }>;
  total_price_yen: number;
  replaces: string;
  savings_percent: number;
  how_to: string;
  source_url?: string;
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
}

export type CurationType = "bundle" | "room_preset" | "influencer_pick" | "hack_set";
