/**
 * 共通カタログ参照の動作確認用（本番UIでは削除可）
 */
import {
  KNOWN_PRODUCTS_DB,
  findByDimensions,
  findProductByModelNumber,
} from "../../shared/catalog/known_products";

const w = 900;
const d = 500;
const h = 2000;
const fit = findByDimensions(w, d, h);
console.log(`空き ${w}x${d}x${h}mm に収まる既知製品: ${fit.length}件`);

const p = findProductByModelNumber("8841424");
console.log("型番8841424:", p?.name ?? "なし");

console.log("カタログ総件数:", KNOWN_PRODUCTS_DB.length);
