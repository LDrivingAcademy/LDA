import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");

const layout = read("src/app/layout.tsx");
const globals = read("src/app/globals.css");
const mainMenu = read("src/components/main-menu.tsx");
const pageTopBar = read("src/components/page-top-bar.tsx");
const homeAccountControls = read("src/components/home-account-controls.tsx");
const dashboardPage = read("src/app/dashboard/page.tsx");
const learnerDashboardMenu = read("src/components/learner-dashboard-menu.tsx");
const instructorDashboardMenu = read("src/components/instructor-dashboard-menu.tsx");
const technicalSupportTopBar = read("src/components/technical-support-top-bar.tsx");
const technicalSupportMenu = read("src/components/technical-support-menu.tsx");
const adminActiveDriversMap = read("src/components/admin-active-drivers-map.tsx");
const languageSelector = read("src/components/language-selector.tsx");
const homepageAiAssistant = read("src/components/homepage-ai-assistant.tsx");
const notificationHubPage = read("src/app/notification-hub/page.tsx");
const trackingPage = read("src/app/tracking/page.tsx");
const learnerJourneyPage = read("src/app/learner-journey/page.tsx");
const prefetcher = read("src/components/route-prefetcher.tsx");
const docs = read("docs/device-compatibility.md");
const packageJson = JSON.parse(read("package.json"));

assert.equal(
  packageJson.scripts["test:device-compatibility"],
  "node scripts/test-device-compatibility.mjs",
  "package.json must expose the device compatibility regression test."
);

assert.match(
  layout,
  /browserCompatibilityBootstrapScript/,
  "Root layout must include the early browser compatibility bootstrap."
);

assert.match(
  layout,
  /id="lda-browser-compatibility-fallback"/,
  "Root layout must include a graceful legacy-browser fallback."
);

assert.match(
  layout,
  /<noscript>/,
  "Root layout must include a JavaScript-disabled fallback."
);

assert.doesNotMatch(
  layout,
  /admin-access|technical-support-access|owner-dashboard|admin-mfa|technical-support-mfa/,
  "Browser fallback must not expose privileged route names."
);

assert.match(
  globals,
  /html\s*\{\s*min-width:\s*320px/,
  "The platform must keep the 320px small-phone baseline."
);

assert.match(
  globals,
  /overflow-x:\s*clip/,
  "The root document must clip accidental horizontal overflow."
);

assert.match(
  globals,
  /body[\s\S]*overflow-x:\s*hidden/,
  "The body must suppress accidental horizontal overflow."
);

assert.match(
  globals,
  /body > \*[\s\S]*min-width:\s*0/,
  "Direct body children and layout containers must be allowed to shrink inside mobile viewports."
);

assert.match(
  globals,
  /@media \(max-width: 640px\)[\s\S]*overflow-x: hidden/,
  "Small screens must keep horizontal overflow suppressed."
);

assert.match(
  globals,
  /@media \(max-width: 480px\)/,
  "Small-phone header controls must have a dedicated compact breakpoint."
);

assert.match(
  globals,
  /@media \(min-width: 1920px\)/,
  "Large desktop and ultrawide map layouts must have a bounded enhancement breakpoint."
);

assert.match(
  globals,
  /\.lda-main-menu-lines[\s\S]*display:\s*flex/,
  "Public mobile menu must render a CSS hamburger fallback."
);

assert.match(
  globals,
  /#lda-browser-compatibility-fallback[\s\S]*display:\s*none/,
  "Legacy browser fallback must stay hidden for modern browsers."
);

assert.match(
  globals,
  /html\.lda-legacy-browser #lda-browser-compatibility-fallback[\s\S]*display:\s*block/,
  "Legacy browser fallback must show only after compatibility detection fails."
);

assert.doesNotMatch(
  mainMenu,
  /import\s*\{\s*Menu\s*\}\s*from "lucide-react"/,
  "The critical mobile menu trigger must not depend on the Lucide SVG menu icon."
);

assert.match(
  mainMenu,
  /aria-label=\{isOpen \? "Close menu" : "Open menu"\}/,
  "The mobile menu trigger must keep its accessible label."
);

assert.match(
  mainMenu,
  /className="lda-main-menu-lines"/,
  "The mobile menu trigger must use the CSS line fallback."
);

assert.match(
  mainMenu,
  /fetch\("\/api\/account\/home-summary"/,
  "The shared menu must recover signed-in account context when a page does not pass it explicitly."
);

assert.match(
  mainMenu,
  /menuLinks\.filter\(\(link\) => !link\.href\.startsWith\("\/auth\/"\)\)/,
  "The shared menu must hide public login and sign-up links while account state is still loading."
);

assert.match(
  pageTopBar,
  /account\?: HeaderAccountSummary \| null/,
  "Shared page top bars must accept server-provided account context for account-aware menus."
);

assert.match(
  pageTopBar,
  /MainMenu account=\{account\}/,
  "Shared page top bars must pass signed-in account context into the menu instead of falling back to public login links."
);

assert.doesNotMatch(
  pageTopBar,
  /^import\s+\{\s*getHeaderAccountSummary[\s\S]*from "@\/lib\/current-account"/m,
  "Shared page top bars must not force every public page into dynamic session rendering."
);

assert.doesNotMatch(
  pageTopBar,
  /MainMenu account=\{null\}/,
  "Shared page top bars must not force signed-in pages to render the public menu."
);

assert.match(
  notificationHubPage,
  /requireSignedInPage/,
  "Notification Hub must remain protected and require a signed-in account."
);

assert.match(
  notificationHubPage,
  /getHeaderAccountSummary/,
  "Notification Hub must read the signed-in account summary for its menu."
);

assert.match(
  notificationHubPage,
  /PageTopBar[\s\S]*account=\{account\}/,
  "Notification Hub must pass account context into the shared top bar."
);

for (const [fileName, source] of [
  ["src/app/tracking/page.tsx", trackingPage],
  ["src/app/learner-journey/page.tsx", learnerJourneyPage]
]) {
  assert.match(
    source,
    /getHeaderAccountSummary/,
    `${fileName} must read account context before rendering its direct mobile menu.`
  );
  assert.doesNotMatch(
    source,
    /<MainMenu\s*\/>/,
    `${fileName} must not render the public menu on account-capable pages.`
  );
}

assert.match(
  pageTopBar,
  /min-\[481px\]:inline-flex/,
  "Shared back links must yield to logo plus menu on very small phones."
);

const compactSignedOutBranch = homeAccountControls.replace(/\r\n/g, "\n").match(/if \(compact\) \{[\s\S]*?\n  \}\n\n  return/)?.[0] ?? "";

assert.ok(
  compactSignedOutBranch,
  "Home account controls must keep a dedicated compact signed-out branch."
);

assert.match(
  compactSignedOutBranch,
  /href="\/auth\/sign-up"[^>]*className="hidden[^" ]*[\s\S]*min-\[480px\]:inline-flex/,
  "Compact sign-up must remain hidden below 480px to preserve room for login and menu."
);

assert.match(
  homeAccountControls,
  /data-lda-account-compact/,
  "Signed-in compact account details must be identifiable for tight-phone priority rules."
);

assert.match(
  dashboardPage,
  /data-lda-account-compact="true"/,
  "Signed-in dashboards must allow account information to collapse before logo/menu controls overflow."
);

assert.match(
  learnerDashboardMenu,
  /className="lda-main-menu-lines"/,
  "Learner dashboard menu must use the CSS hamburger fallback."
);

assert.match(
  instructorDashboardMenu,
  /className="lda-main-menu-lines"/,
  "Instructor dashboard menu must use the CSS hamburger fallback."
);

assert.match(
  technicalSupportTopBar,
  /TechnicalSupportMenu/,
  "Technical Operations Centre must expose a compact menu on mobile."
);

assert.match(
  technicalSupportMenu,
  /aria-label=\{isOpen \? "Close technical support menu" : "Open technical support menu"\}/,
  "Technical support menu must keep an accessible toggle label."
);

assert.match(
  adminActiveDriversMap,
  /lda-responsive-map/,
  "Admin active-driver maps must render inside the bounded polished-map responsive container."
);

assert.match(
  languageSelector,
  /menuBounded \? "relative mt-3"/,
  "Language selector dropdown must expand inside mobile menu panels instead of floating over the page."
);

assert.match(
  homepageAiAssistant,
  /sm:not-sr-only/,
  "Homepage chat launcher must collapse to icon-only on phone-sized screens."
);

assert.match(
  prefetcher,
  /saveData/,
  "Route preloading must respect data-saver connections."
);

assert.match(
  prefetcher,
  /2g/,
  "Route preloading must stay light on slow mobile connections."
);

for (const width of ["320px", "375px", "390px", "412px", "430px", "440px", "480px", "768px", "1024px", "1280px", "1366px", "1440px", "1512px", "1920px", "2560px"]) {
  assert.match(
    docs,
    new RegExp(width.replace("px", "px")),
    `Device compatibility docs must include the ${width} regression width.`
  );
}

assert.match(
  docs,
  /Very old devices and browsers/,
  "Device compatibility docs must explain the legacy-browser fallback boundary."
);

assert.match(
  docs,
  /Privileged admin and technical support routes remain hidden/,
  "Device compatibility docs must preserve privileged route security expectations."
);

console.log("Device compatibility safeguards passed.");
