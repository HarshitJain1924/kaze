/**
 * Responsive smoke test using an installed Chrome and the DevTools protocol.
 * Checks for horizontal document overflow and verifies that the right
 * navigation is visible at each breakpoint.
 *
 * Usage:
 *   npm run qa:responsive
 *   QA_BASE_URL=http://localhost:3000 npm run qa:responsive
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE_URL = process.env.QA_BASE_URL ?? "http://localhost:3000";
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

const PAGES = ["/", "/discover", "/schedule", "/anime/154587", "/login"];
const VIEWPORTS = [
  { width: 320, height: 700, name: "mobile-320" },
  { width: 390, height: 844, name: "mobile-390" },
  { width: 768, height: 1024, name: "tablet-768" },
  { width: 1024, height: 800, name: "laptop-1024" },
  { width: 1440, height: 900, name: "desktop-1440" },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const chromePath = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));
if (!chromePath) {
  console.error("Chrome not found. Set CHROME_PATH to run the responsive QA.");
  process.exit(1);
}

const profile = mkdtempSync(join(tmpdir(), "kaze-qa-"));
const chrome = spawn(
  chromePath,
  [
    "--headless=new",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--hide-scrollbars",
    "about:blank",
  ],
  { stdio: "ignore" },
);

// Do not let the browser keep the script alive; cleanup kills it explicitly.
chrome.unref();

function cleanup() {
  try {
    chrome.kill();
  } catch {
    // Chrome may already be gone.
  }
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {
    // The temporary profile is best-effort cleanup.
  }
}

process.on("exit", cleanup);

async function readDebugPort() {
  const portFile = join(profile, "DevToolsActivePort");
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (existsSync(portFile)) {
      const [port] = readFileSync(portFile, "utf8").split("\n");
      if (port) {
        return Number.parseInt(port, 10);
      }
    }
    await sleep(100);
  }
  throw new Error("Chrome DevTools port did not become available");
}

function createSession(wsUrl) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl);
    const pending = new Map();
    let nextId = 0;

    socket.addEventListener("open", () => {
      resolve({
        send(method, params = {}) {
          return new Promise((res, rej) => {
            nextId += 1;
            pending.set(nextId, { res, rej });
            socket.send(JSON.stringify({ id: nextId, method, params }));
          });
        },
        close() {
          socket.close();
        },
      });
    });

    socket.addEventListener("error", () => {
      reject(new Error("Could not connect to the Chrome DevTools socket"));
    });

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && pending.has(message.id)) {
        const { res, rej } = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) {
          rej(new Error(JSON.stringify(message.error)));
        } else {
          res(message.result);
        }
      }
    });
  });
}

const EVALUATE = `(() => {
  const doc = document.documentElement;
  const overflow = Math.max(0, doc.scrollWidth - window.innerWidth);
  const offenders = [...document.querySelectorAll('main *')]
    .filter((element) => {
      const style = getComputedStyle(element);
      if (style.position === 'fixed') return false;
      if (style.overflowX === 'auto' || style.overflowX === 'scroll') return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && (rect.right > window.innerWidth + 1 || rect.left < -1);
    })
    .slice(0, 5)
    .map((element) => element.tagName + '.' + String(element.className).slice(0, 70));

  const aside = document.querySelector('aside');
  const bottomNav = [...document.querySelectorAll('nav')].find((nav) =>
    getComputedStyle(nav).position === 'fixed'
  );

  return JSON.stringify({
    title: document.title,
    overflow,
    scrollWidth: doc.scrollWidth,
    viewport: window.innerWidth,
    cards: document.querySelectorAll('article').length,
    sidebarVisible: aside ? getComputedStyle(aside).display !== 'none' : false,
    bottomNavVisible: bottomNav
      ? getComputedStyle(bottomNav).display !== 'none'
      : false,
    offenders,
  });
})()`;

async function navigate(path) {
  await session.send("Page.navigate", { url: `${BASE_URL}${path}` });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const ready = await session.send("Runtime.evaluate", {
      expression: "document.readyState",
      returnByValue: true,
    });
    if (ready.result.value === "complete") {
      break;
    }
    await sleep(100);
  }
  await sleep(700);
}

async function evaluate(expression) {
  const result = await session.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
  });
  return result.result.value;
}

const port = await readDebugPort();
const targetResponse = await fetch(
  `http://127.0.0.1:${port}/json/new?about:blank`,
  { method: "PUT" },
);
const target = await targetResponse.json();
const session = await createSession(target.webSocketDebuggerUrl);

await session.send("Page.enable");
await session.send("Runtime.enable");

let failures = 0;

for (const viewport of VIEWPORTS) {
  await session.send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.width < 768,
  });

  for (const path of PAGES) {
    await navigate(path);

    const metrics = JSON.parse(await evaluate(EVALUATE));

    // The login screen sits outside the app shell and intentionally has no
    // sidebar or bottom navigation.
    const inAppShell = path !== "/login";
    const expectedSidebar = inAppShell && viewport.width >= 1024;
    const expectedBottomNav = inAppShell && viewport.width < 1024;
    const navOk =
      !inAppShell ||
      (metrics.sidebarVisible === expectedSidebar &&
        metrics.bottomNavVisible === expectedBottomNav);
    const ok = metrics.overflow <= 1 && navOk;
    if (!ok) {
      failures += 1;
    }

    console.log(
      `${ok ? "PASS" : "FAIL"} ${viewport.name.padEnd(12)} ${path.padEnd(14)} ` +
        `overflow=${metrics.overflow}px cards=${metrics.cards} ` +
        `sidebar=${metrics.sidebarVisible} bottomNav=${metrics.bottomNavVisible}` +
        (metrics.offenders.length > 0
          ? `\n       offenders: ${metrics.offenders.join(" | ")}`
          : ""),
    );
  }
}

function record(name, passed, detail) {
  if (!passed) {
    failures += 1;
  }
  console.log(
    `${passed ? "PASS" : "FAIL"} flow         ${name}${detail ? ` (${detail})` : ""}`,
  );
}

const TYPE_IN_SEARCH = `(() => {
  const input = document.querySelector('input[role="searchbox"]');
  if (!input) return false;
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  ).set;
  setter.call(input, VALUE);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()`;

// Browser-level flow checks for everything reachable without Supabase
// credentials: live debounced search, empty results, the auth gate on quick
// add, and the sign-in action on an anime page.
await session.send("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});

async function attemptSearch(query) {
  await navigate("/discover");
  await evaluate(TYPE_IN_SEARCH.replace("VALUE", JSON.stringify(query)));
  await sleep(2500);
  return JSON.parse(
    await evaluate(`JSON.stringify({
      search: location.search,
      cards: document.querySelectorAll('article').length,
      firstTitle: document.querySelector('article h3')
        ? document.querySelector('article h3').textContent
        : null,
      emptyState: document.body.innerText.includes('No anime found'),
      errorState:
        document.body.innerText.toLowerCase().includes('unreachable') ||
        document.body.innerText.toLowerCase().includes('rate limit'),
    })`),
  );
}

const SEARCH_QUERY = "cowboy bebop";
let searchState = await attemptSearch(SEARCH_QUERY);

// AniList allows roughly 30 requests per minute. When this environment has
// burned that budget the UI shows its error state; wait for the window to
// reset and try once more, then report the check as skipped rather than
// pretending it passed.
if (searchState.errorState && searchState.cards === 0) {
  console.log(
    "      … AniList rate limited; waiting 65s before one retry",
  );
  await sleep(65_000);
  searchState = await attemptSearch(SEARCH_QUERY);
}

if (searchState.errorState && searchState.cards === 0) {
  console.log(
    "SKIP flow         debounced search (AniList rate limited in this environment)",
  );
} else {
  record(
    "debounced search updates the URL and results",
    searchState.search.includes("q=cowboy") && searchState.cards > 0,
    `cards=${searchState.cards} first="${searchState.firstTitle}"`,
  );
}

const emptySearch = await attemptSearch("qqqzzzxxyynope");
if (emptySearch.errorState && emptySearch.cards === 0) {
  console.log(
    "SKIP flow         empty search state (AniList rate limited in this environment)",
  );
} else {
  record(
    "empty search results render an empty state",
    emptySearch.emptyState === true,
    `cards=${emptySearch.cards}`,
  );
}

await navigate("/discover");
const clickedAdd = await evaluate(`(() => {
  const button = document.querySelector('button[aria-label^="Add "]');
  if (!button) return false;
  button.click();
  return true;
})()`);
await sleep(1500);
const gate = JSON.parse(
  await evaluate(`JSON.stringify({ path: location.pathname, search: location.search })`),
);
record(
  "quick add sends signed-out visitors to sign in",
  clickedAdd === true &&
    gate.path === "/login" &&
    gate.search.includes("next=%2Fdiscover"),
  `${gate.path}${gate.search}`,
);

await navigate("/anime/154587");
const detail = JSON.parse(
  await evaluate(`JSON.stringify({
    path: location.pathname,
    textLength: document.body.innerText.length,
    hasCommunity: document.body.innerText.toLowerCase().includes('community'),
    hasRelated: document.body.innerText.includes('Related anime'),
    signInHref: (() => {
      const panel = document.querySelector(
        'section[aria-label="Your library actions"]',
      );
      const link = panel ? panel.querySelector('a') : null;
      return link ? link.getAttribute('href') : null;
    })(),
  })`),
);
record(
  "anime details render metadata, relations and a sign-in action",
  detail.hasCommunity === true &&
    detail.hasRelated === true &&
    typeof detail.signInHref === "string" &&
    detail.signInHref.includes("/login?next="),
  `path=${detail.path} community=${detail.hasCommunity} related=${detail.hasRelated} text=${detail.textLength} href=${detail.signInHref}`,
);

await session.send("Emulation.setDeviceMetricsOverride", {
  width: 768,
  height: 1024,
  deviceScaleFactor: 1,
  mobile: false,
});
await navigate("/");
await evaluate(`(() => {
  document.documentElement.classList.add('light');
  document.documentElement.dataset.theme = 'light';
  return true;
})()`);
await sleep(400);
const lightTheme = JSON.parse(
  await evaluate(`(() => {
    const background = getComputedStyle(document.body).backgroundColor;
    const color = getComputedStyle(document.body).color;
    const overflow = Math.max(
      0,
      document.documentElement.scrollWidth - window.innerWidth,
    );
    const rootStyle = getComputedStyle(document.documentElement);
    // Resolve the design token rather than pinning one palette, so every
    // design direction can be checked in light appearance.
    const probe = document.createElement('span');
    probe.style.color = rootStyle.getPropertyValue('--bg').trim();
    document.body.appendChild(probe);
    const rootBgRgb = getComputedStyle(probe).color;
    probe.remove();
    return JSON.stringify({
      background,
      color,
      overflow,
      hasClass: document.documentElement.classList.contains('light'),
      rootBg: rootStyle.getPropertyValue('--bg').trim(),
      rootBgRgb,
      colorScheme: rootStyle.colorScheme,
    });
  })()`),
);
record(
  "light theme applies and keeps the layout within the viewport",
  lightTheme.hasClass === true &&
    lightTheme.background === lightTheme.rootBgRgb &&
    lightTheme.overflow <= 1,
  `background=${lightTheme.background} hasClass=${lightTheme.hasClass} rootBg=${lightTheme.rootBg} colorScheme=${lightTheme.colorScheme} overflow=${lightTheme.overflow}`,
);

session.close();
cleanup();

if (failures > 0) {
  console.error(`\n${failures} responsive check(s) failed.`);
  process.exit(1);
}

console.log("\nAll responsive checks passed.");
process.exit(0);
