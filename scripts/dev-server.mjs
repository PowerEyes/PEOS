import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";

const app = process.argv[2];
if (app !== "erp" && app !== "web") {
  console.error("Usage: node scripts/dev-server.mjs <erp|web>");
  process.exit(1);
}

const port = Number(process.env.PORT || (app === "erp" ? 3001 : 3000));
const dir = fileURLToPath(new URL(`../apps/${app}`, import.meta.url));
const require = createRequire(path.join(dir, "package.json"));
const next = require("next");
const devApp = next({ dev: true, dir, hostname: "localhost", port });
await devApp.prepare();

const handle = devApp.getRequestHandler();

http
  .createServer((req, res) => {
    // Next.js logs req.url on every dev request. Move the single-use recovery
    // code into a header before Next sees it so it never reaches terminal logs.
    const target = req.url || "/";
    const question = target.indexOf("?");
    if (question !== -1) {
      const search = new URLSearchParams(target.slice(question + 1));
      const code = search.get("code");
      if (code) {
        req.headers["x-poweros-reset-code"] = code;
        search.delete("code");
        const query = search.toString();
        req.url = target.slice(0, question) + (query ? `?${query}` : "");
      }
    }
    handle(req, res);
  })
  .listen(port, () => {
    console.log(`PowerOS ${app} dev server ready on http://localhost:${port}`);
  });
