import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const label = process.argv[2] || "before";
const OUT = "screenshots";
const BASE = "http://localhost:3000";
const CHROME = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].filter(Boolean).find((p) => existsSync(p));
if (!CHROME) throw new Error("Chrome not found");
mkdirSync(OUT, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), "kaze-discovery-"));
const chrome = spawn(CHROME, [
  "--headless=new",
  "--remote-debugging-port=0",
  `--user-data-dir=${profile}`,
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-gpu",
  "--hide-scrollbars",
  "about:blank",
], { stdio: "ignore" });
chrome.unref();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cleanup = () => {
  try { chrome.kill(); } catch {}
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
};
process.on("exit", cleanup);

let port = 0;
for (let i = 0; i < 100; i += 1) {
  const f = join(profile, "DevToolsActivePort");
  if (existsSync(f)) { port = Number(readFileSync(f, "utf8").split("\n")[0]); break; }
  await sleep(100);
}
const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map(); let id = 0;
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", reject, { once: true });
});
ws.addEventListener("message", (event) => {
  const msg = JSON.parse(event.data);
  const p = pending.get(msg.id);
  if (!p) return;
  pending.delete(msg.id);
  msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  id += 1; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  return result.result?.value;
};
async function waitReady() {
  for (let i = 0; i < 100; i += 1) {
    if ((await evaluate("document.readyState")) === "complete") break;
    await sleep(100);
  }
  await sleep(1500);
}

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: `${BASE}/dashboard` });
await waitReady();

// Scroll directly to the Beyond your shelf discovery heading
const discoveryY = await evaluate(`(() => {
  const el = document.getElementById("discovery-heading");
  if (!el) return 1400;
  const rect = el.getBoundingClientRect();
  return window.scrollY + rect.top - 80;
})()`);

await evaluate(`window.scrollTo(0, ${discoveryY}); true`);
await sleep(600);

const result = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
writeFileSync(join(OUT, `discovery-${label}.png`), Buffer.from(result.data, "base64"));
console.log(`Saved screenshots/discovery-${label}.png at scroll ${discoveryY}`);

// Also capture the bottom half of discovery (trending & reading shelf)
await evaluate(`window.scrollTo(0, ${discoveryY + 650}); true`);
await sleep(600);
const result2 = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
writeFileSync(join(OUT, `discovery-${label}-lower.png`), Buffer.from(result2.data, "base64"));
console.log(`Saved screenshots/discovery-${label}-lower.png`);

ws.close();
cleanup();
process.exit(0);

