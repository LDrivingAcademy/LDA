import assert from "node:assert/strict";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].filter(Boolean);

const chromePath = chromeCandidates.find((candidate) => existsSync(candidate));

if (!chromePath) {
  console.log("Responsive runtime audit skipped: Chrome executable was not found.");
  process.exit(0);
}

const baseUrl = process.env.LDA_RESPONSIVE_BASE_URL ?? "http://localhost:3000";
const widths = [320, 375, 390, 430, 480, 768, 1024, 1280, 1366, 1512, 1920, 2560];
const routes = ["/", "/about", "/smart-match", "/lesson-now", "/scheduled-lessons", "/support/guest", "/feedback", "/theory-test"];
const screenshotDir = join(process.cwd(), ".codex-responsive-shots");

mkdirSync(screenshotDir, { recursive: true });

const chrome = spawn(chromePath, [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  "--no-first-run",
  "--no-default-browser-check",
  "--remote-debugging-port=9223",
  "about:blank",
], {
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForDebugger() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch("http://127.0.0.1:9223/json/version");
      if (response.ok) {
        return response.json();
      }
    } catch {
      await wait(250);
    }
  }

  throw new Error("Chrome DevTools endpoint did not become available.");
}

class Cdp {
  constructor(wsUrl) {
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.socket = new WebSocket(wsUrl);
  }

  async open() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });

    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) {
          reject(new Error(message.error.message));
        } else {
          resolve(message.result ?? {});
        }
        return;
      }

      const callbacks = this.listeners.get(message.method);
      if (callbacks) {
        callbacks.forEach((callback) => callback(message.params ?? {}));
      }
    });
  }

  on(method, callback) {
    if (!this.listeners.has(method)) {
      this.listeners.set(method, new Set());
    }
    this.listeners.get(method).add(callback);
    return () => this.listeners.get(method)?.delete(callback);
  }

  send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    const payload = JSON.stringify({ id, method, params });
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(payload);
    });
  }

  close() {
    this.socket.close();
  }
}

async function newPage() {
  const response = await fetch("http://127.0.0.1:9223/json/new?about:blank", { method: "PUT" });
  if (!response.ok) {
    throw new Error(`Unable to create Chrome tab: ${response.status}`);
  }
  return response.json();
}

async function auditPage(cdp, route, width) {
  const height = width < 768 ? 1100 : width < 1366 ? 1200 : 1400;
  let mainDocumentStatus = null;

  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 768,
    screenWidth: width,
    screenHeight: height,
  });

  const removeNetworkListener = cdp.on("Network.responseReceived", (params) => {
    if (params.type === "Document" && params.response.url.startsWith(baseUrl)) {
      mainDocumentStatus = params.response.status;
    }
  });

  const loaded = new Promise((resolve) => cdp.on("Page.loadEventFired", resolve));
  await cdp.send("Page.navigate", { url: `${baseUrl}${route}` });
  await loaded;
  await wait(600);
  removeNetworkListener();

  const evaluation = await cdp.send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const viewportWidth = window.innerWidth;
      const documentWidth = Math.max(
        document.documentElement.scrollWidth,
        document.body ? document.body.scrollWidth : 0
      );
      const offenders = [];
      const ignored = new Set(["SCRIPT", "STYLE", "META", "LINK", "TITLE", "NOSCRIPT"]);
      document.querySelectorAll("body *").forEach((element) => {
        if (ignored.has(element.tagName)) return;
        const styles = window.getComputedStyle(element);
        if (styles.display === "none" || styles.visibility === "hidden") return;
        const rect = element.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) return;
        const intentionalScrollable = styles.overflowX === "auto" || styles.overflowX === "scroll";
        if (intentionalScrollable) return;
        const leftOverflow = Math.floor(rect.left) < -3;
        const rightOverflow = Math.ceil(rect.right) > viewportWidth + 3;
        if (leftOverflow || rightOverflow) {
          offenders.push({
            tag: element.tagName.toLowerCase(),
            text: (element.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 80),
            className: typeof element.className === "string" ? element.className.slice(0, 120) : "",
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
          });
        }
      });
      const header = document.querySelector(".lda-universal-topbar, header");
      const mainMenu = document.querySelector('[aria-label*="menu" i]');
      return {
        title: document.title,
        url: window.location.href,
        viewportWidth,
        documentWidth,
        horizontalOverflow: documentWidth - viewportWidth,
        offenders: offenders.slice(0, 8),
        headerHeight: header ? Math.round(header.getBoundingClientRect().height) : null,
        hasMenuButton: Boolean(mainMenu),
        bodyTextLength: document.body ? document.body.innerText.trim().length : 0,
      };
    })()`,
  });

  const value = evaluation.result.value;
  assert.ok(value.bodyTextLength > 100, `${route} at ${width}px rendered too little visible text.`);
  assert.ok(mainDocumentStatus === 200 || mainDocumentStatus === 304, `${route} at ${width}px rendered ${value.url} with status ${mainDocumentStatus}.`);
  assert.ok(value.horizontalOverflow <= 3, `${route} at ${width}px has ${value.horizontalOverflow}px horizontal overflow.`);
  assert.deepEqual(value.offenders, [], `${route} at ${width}px has visible elements outside the viewport.`);
  assert.ok(value.hasMenuButton, `${route} at ${width}px must keep a visible menu control.`);

  if (["/", "/smart-match", "/about"].includes(route) && [320, 390, 768, 1366, 1920, 2560].includes(width)) {
    const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    const name = `${route === "/" ? "home" : route.slice(1).replaceAll("/", "-")}-${width}.png`;
    writeFileSync(join(screenshotDir, name), Buffer.from(screenshot.data, "base64"));
  }

  return { route, width, ...value };
}

try {
  await waitForDebugger();
  const tab = await newPage();
  const cdp = new Cdp(tab.webSocketDebuggerUrl);
  await cdp.open();
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Network.enable");

  const results = [];

  for (const route of routes) {
    for (const width of widths) {
      results.push(await auditPage(cdp, route, width));
    }
  }

  cdp.close();

  const maxOverflow = Math.max(...results.map((result) => result.horizontalOverflow));
  console.log(`Responsive runtime audit passed across ${routes.length} routes and ${widths.length} widths. Max overflow: ${maxOverflow}px.`);
} finally {
  chrome.kill();
}
