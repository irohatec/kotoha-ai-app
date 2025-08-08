import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;

// __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// パス
const rootDir = __dirname;
const publicDir = path.join(__dirname, "public");

// 静的配信（public があれば優先、その後に root も配信）
if (fs.existsSync(publicDir)) app.use(express.static(publicDir));
app.use(express.static(rootDir));

// ヘルスチェック
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

// ルート（/）— public/index.html → root/index.html → フォールバック
app.get("/", (_req, res) => {
  const publicIndex = path.join(publicDir, "index.html");
  const rootIndex = path.join(rootDir, "index.html");
  if (fs.existsSync(publicIndex)) return res.sendFile(publicIndex);
  if (fs.existsSync(rootIndex)) return res.sendFile(rootIndex);
  return res
    .status(200)
    .type("html")
    .send(`<!doctype html><meta charset="utf-8"><title>セットアップ中</title>
<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,"Helvetica Neue",Arial,"Noto Sans JP",sans-serif;line-height:1.6;padding:24px}</style>
<h1>✅ サーバは稼働中</h1>
<p><code>public/index.html</code> または ルート直下の <code>index.html</code> を配置してください。</p>`);
});

// SPA向けキャッチオール（APIは上で定義していないので最後に配置）
app.get("*", (_req, res) => {
  const publicIndex = path.join(publicDir, "index.html");
  const rootIndex = path.join(rootDir, "index.html");
  if (fs.existsSync(publicIndex)) return res.sendFile(publicIndex);
  if (fs.existsSync(rootIndex)) r
