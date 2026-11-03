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
const profile = mkdtempSync(join(tmpdir(), "kaze-header-"));
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

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 950, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: `${BASE}/dashboard` });
await waitReady();

// Measure exact Y coordinates of key landmarks
const metrics = await evaluate(`(() => {
  const archive = document.querySelector('header');
  const quickFind = document.querySelector('[role=\"searchbox\"]')?.closest('.relative.z-30');
  const nextSection = document.querySelector('section');
  
  return {
    archiveHeight: archive ? archive.offsetHeight : null,
    quickFindTop: quickFind ? quickFind.getBoundingClientRect().top : null,
    nextSectionTop: nextSection ? nextSection.getBoundingClientRect().top : null,
  };
})()`);
console.log("Measurements:", metrics);

const result = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
writeFileSync(join(OUT, `header-${label}-1440.png`), Buffer.from(result.data, "base64"));
console.log(`Saved screenshots/header-${label}-1440.png`);

for (const [w, h] of [[1024, 800], [768, 1024], [390, 844]]) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 768 });
  await send("Page.navigate", { url: `${BASE}/dashboard` });
  await waitReady();
  const res = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
  writeFileSync(join(OUT, `header-${label}-${w}.png`), Buffer.from(res.data, "base64"));
  console.log(`Saved screenshots/header-${label}-${w}.png`);
}

ws.close();
cleanup();
process.exit(0);
