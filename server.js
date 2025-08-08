import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;

// __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ルート直下のファイルだけを配信し、必ず index.html を返す
app.use(express.static(__dirname));

app.get("/healthz", (_req, res) => res.status(200).send("ok"));

// SPA想定：存在しないパスでも常に index.html
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
