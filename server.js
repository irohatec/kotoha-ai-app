import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;

// __dirname をESMで再現
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 静的配信ディレクトリ（後で index.html を置く）
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));

// ヘルスチェック
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

// ルート & SPAキャッチオール
app.get("*", (_req, res) => {
  const indexPath = path.join(publicDir, "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // まだ index.html が無くても 200 を返してサイトが「壊れた」状態に見えないようにする
    res
      .status(200)
      .type("html")
      .send(`<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>セットアップ中</title>
<style>body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans JP",sans-serif;line-height:1.6;padding:24px}code{background:#f3f4f6;padding:2px 6px;border-radius:6px}</style>
</head><body>
<h1>✅ サーバは稼働中</h1>
<p><code>/healthz</code> は <strong>ok</strong> を返します。</p>
<p>次のステップ：<code>public/index.html</code> を追加してください。</p>
</body></html>`);
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
