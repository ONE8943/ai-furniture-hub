/**
 * シーン別コーディネート知識DB
 *
 * intentテキストから設置場所を推定し、
 * そのシーンに最適な棚+収納の検索キーワードとコツを返す。
 */

export interface SceneCoordinate {
  scene: string;
  aliases: string[];
  description: string;
  recommended_shelf_keywords: string[];
  recommended_storage_keywords: string[];
  tips: string[];
}

export const SCENE_DB: SceneCoordinate[] = [
  {
    scene: "押入れ・クローゼット",
    aliases: ["押入れ", "クローゼット", "押し入れ", "衣装", "布団"],
    description: "奥行きのある押入れ・クローゼット内の整理",
    recommended_shelf_keywords: [
      "押入れ収納ラック",
      "クローゼット 棚",
      "押入れ キャスター付き",
    ],
    recommended_storage_keywords: [
      "収納ボックス 押入れ",
      "衣装ケース",
      "布団収納袋",
    ],
    tips: [
      "押入れは奥行き約80cmが標準。手前と奥で2列使いが効果的",
      "キャスター付きラックなら奥のものも取り出しやすい",
      "上段はよく使うもの、下段は季節ものがおすすめ",
    ],
  },
  {
    scene: "洗面所・脱衣所",
    aliases: ["洗面", "脱衣", "洗濯機", "ランドリー", "タオル"],
    description: "洗面台周りや洗濯機横の隙間収納",
    recommended_shelf_keywords: [
      "隙間収納 スリム",
      "ランドリーラック",
      "洗面所 棚",
      "洗濯機横 ラック",
    ],
    recommended_storage_keywords: [
      "収納ボックス スリム",
      "タオル収納",
      "洗剤収納 ラック",
    ],
    tips: [
      "洗濯機横の隙間は15-30cmが多い。スリムタイプを選ぶ",
      "湿気に強い素材（ステンレス・プラスチック）がおすすめ",
      "タオルは丸めて立てて収納すると取り出しやすい",
    ],
  },
  {
    scene: "トイレ",
    aliases: ["トイレ", "便所", "手洗い"],
    description: "トイレ内の限られたスペースの収納",
    recommended_shelf_keywords: [
      "トイレ収納 スリム",
      "トイレラック",
      "トイレ 棚 壁面",
    ],
    recommended_storage_keywords: [
      "トイレ 収納ボックス",
      "トイレットペーパー収納",
      "サニタリー収納",
    ],
    tips: [
      "幅14-20cmのスリムタイプが定番",
      "壁面収納で床面積を確保すると掃除がしやすい",
      "ストック品は隠せる扉付きがおすすめ",
    ],
  },
  {
    scene: "キッチン",
    aliases: ["キッチン", "台所", "食器", "調味料", "シンク下", "コンロ"],
    description: "キッチン周りの食器・調味料・食品収納",
    recommended_shelf_keywords: [
      "キッチンラック",
      "食器棚",
      "レンジ台",
      "シンク下 ラック",
    ],
    recommended_storage_keywords: [
      "キッチン収納ボックス",
      "調味料ラック",
      "ファイルボックス キッチン",
    ],
    tips: [
      "コンロ下・シンク下は引き出し式のラックで奥まで活用",
      "ファイルボックスでフライパンを立てて収納すると取り出しやすい",
      "調味料は統一ボトルに詰め替えるとスッキリ",
    ],
  },
  {
    scene: "リビング",
    aliases: ["リビング", "居間", "テレビ", "本棚", "リモコン", "雑誌"],
    description: "リビングの壁面収納・テレビ周り・本棚",
    recommended_shelf_keywords: [
      "カラーボックス",
      "テレビ台 収納",
      "本棚 シェルフ",
      "壁面収納",
    ],
    recommended_storage_keywords: [
      "インボックス カラーボックス",
      "収納ボックス 蓋付き",
      "ファイルボックス",
    ],
    tips: [
      "カラーボックスは横置きでも使え、ベンチ兼収納になる",
      "見せる収納と隠す収納のバランスが大事",
      "統一感のあるボックスで揃えると見た目がスッキリ",
    ],
  },
  {
    scene: "子供部屋",
    aliases: ["子供", "こども", "キッズ", "おもちゃ", "ランドセル", "学習"],
    description: "子供部屋のおもちゃ・学用品収納",
    recommended_shelf_keywords: [
      "カラーボックス 3段",
      "おもちゃ収納 ラック",
      "ランドセルラック",
    ],
    recommended_storage_keywords: [
      "おもちゃ箱",
      "収納ボックス カラーボックス",
      "インナーケース",
    ],
    tips: [
      "子供の目線の高さに合わせて配置すると自分で片付けやすい",
      "ラベルを貼って「何をどこに」を明確にする",
      "角が丸い収納ボックスが安全",
    ],
  },
  {
    scene: "玄関",
    aliases: ["玄関", "靴", "シューズ", "傘", "スリッパ"],
    description: "玄関の靴・傘・小物収納",
    recommended_shelf_keywords: [
      "シューズラック",
      "靴棚",
      "玄関 収納",
      "傘立て",
    ],
    recommended_storage_keywords: [
      "シューズボックス",
      "靴収納ケース",
      "玄関 小物入れ",
    ],
    tips: [
      "縦型ラックなら省スペースで収納量を確保できる",
      "オフシーズンの靴はボックスに入れて上段に",
      "鍵・印鑑は玄関にまとめると外出時に便利",
    ],
  },
];

/**
 * intentテキストからシーンを推定する
 */
export function detectScene(intentText: string): SceneCoordinate | null {
  const lower = intentText.normalize("NFKC").toLowerCase();
  for (const scene of SCENE_DB) {
    if (scene.aliases.some((alias) => lower.includes(alias))) {
      return scene;
    }
  }
  return null;
}
