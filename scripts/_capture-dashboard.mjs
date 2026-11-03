import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const OUT = "screenshots";
const BASE = "http://localhost:3000";
const CHROME = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].filter(Boolean).find((p) => existsSync(p));
if (!CHROME) throw new Error("Chrome not found");
mkdirSync(OUT, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), "kaze-capture-"));
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
  await sleep(1200);
}
async function load(width, height, theme, design) {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 768 });
  await send("Page.navigate", { url: `${BASE}/dashboard` });
  await waitReady();
  await evaluate(`localStorage.setItem('kaze-theme', ${JSON.stringify(theme)}); localStorage.setItem('kaze-design', ${JSON.stringify(design)}); location.reload(); true`);
  await waitReady();
}
async function shot(name, scrollY = 0) {
  await evaluate(`window.scrollTo(0, ${scrollY}); true`);
  await sleep(350);
  const result = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
  writeFileSync(join(OUT, name), Buffer.from(result.data, "base64"));
  console.log("captured", name);
}
await send("Page.enable");
await send("Runtime.enable");
for (const theme of ["dark", "light"]) {
  for (const design of ["broadcast", "editorial", "shelf"]) {
    await load(1440, 1100, theme, design);
    await shot(`dashboard-${theme}-${design}-1440.png`);
  }
}
for (const [width, height] of [[360, 800], [390, 844], [768, 1024], [1024, 800], [1440, 1100], [1920, 1080]]) {
  await load(width, height, "dark", "broadcast");
  await shot(`dashboard-dark-broadcast-${width}.png`);
}
await load(1440, 1100, "dark", "broadcast");
await shot("dashboard-dark-broadcast-1440-personal.png", 620);
await shot("dashboard-dark-broadcast-1440-week.png", 1250);
ws.close(); cleanup(); process.exit(0);
