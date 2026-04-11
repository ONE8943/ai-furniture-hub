#!/usr/bin/env node
/**
 * pre-commit hook: 機密情報のコミットを自動ブロック
 *
 * .env から実キーを読み取り、ステージ済みファイルの差分に
 * 含まれていたらコミットを中止する。
 */
const { execSync } = require("child_process");
const { readFileSync, existsSync } = require("fs");
const { join } = require("path");

const RED = "\x1b[31m";
const NC = "\x1b[0m";

function run(cmd) {
  try {
    return execSync(cmd, { encoding: "utf-8" }).trim();
  } catch {
    return "";
  }
}

const root = run("git rev-parse --show-toplevel");
const staged = run("git diff --cached --name-only --diff-filter=ACMR")
  .split("\n")
  .filter((f) => f && f !== ".env" && !f.startsWith(".secrets_backup/"));

if (staged.length === 0) process.exit(0);

const diff = run("git diff --cached -U0 -- " + staged.map((f) => `"${f}"`).join(" "));
if (!diff) process.exit(0);

let blocked = false;

// --- 1. .env の実値チェック ---
const envPath = join(root, ".env");
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    if (line.startsWith("#") || !line.includes("=")) continue;
    const eqIdx = line.indexOf("=");
    const key = line.slice(0, eqIdx).trim();
    const val = line.slice(eqIdx + 1).trim();

    if (!val || val.length <= 6) continue;

    const safe = ["true", "false", "mcp_hub", "ai_agent", "mcp_hub_affiliate"];
    if (safe.includes(val)) continue;
    if (val.startsWith("Mozilla/")) continue;

    const addedOnly = diff.split("\n")
      .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
      .join("\n");
    if (addedOnly.includes(val)) {
      console.error(`${RED}[BLOCKED]${NC} .env の '${key}' の実値がコミットに含まれています`);
      blocked = true;
    }
  }
}

// --- 2. 既知の危険パターン ---
const patterns = [
  { re: /AIzaSy[a-zA-Z0-9_-]{30,}/g, label: "Google APIキー" },
  { re: /pk_[a-zA-Z0-9]{20,}/g, label: "APIアクセスキー (pk_)" },
  { re: /sk_[a-zA-Z0-9]{20,}/g, label: "APIシークレットキー (sk_)" },
  { re: /[0-9a-f]{8}\.[0-9a-f]{8}\.[0-9a-f]{8}\.[0-9a-f]{8}/g, label: "楽天アフィリエイトID形式" },
  { re: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, label: "IPアドレス" },
];

const addedLines = diff.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++"));

for (const { re, label } of patterns) {
  for (const line of addedLines) {
    const matches = line.match(re);
    if (!matches) continue;
    for (const m of matches) {
      // IPの誤検知を除外 (バージョン番号等)
      if (label === "IPアドレス") {
        const parts = m.split(".").map(Number);
        if (parts.every((p) => p < 10)) continue; // 1.2.3.4 みたいなバージョンは無視
        if (m === "0.0.0.0" || m === "127.0.0.1") continue;
      }
      console.error(`${RED}[BLOCKED]${NC} ${label}を検出: ${m.slice(0, 20)}...`);
      blocked = true;
    }
  }
}

if (blocked) {
  console.error("");
  console.error("コミットをブロックしました。機密情報を除去してください。");
  console.error("意図的な場合: git commit --no-verify");
  process.exit(1);
}

process.exit(0);
