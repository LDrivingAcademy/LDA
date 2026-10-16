import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const launcherPath = "/director-master-key-lda-admin-9f4e7c2b6a";
const privateAccessPath = `${launcherPath}/access`;

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

const launcherRoute = read("src/app/director-master-key-lda-admin-9f4e7c2b6a/route.ts");
const publicAccessPage = read("src/app/admin-access/page.tsx");
const privateAccessPage = read("src/app/director-master-key-lda-admin-9f4e7c2b6a/access/page.tsx");
const middleware = read("src/middleware.ts");
const usbUpdater = read("scripts/update-usb-master-key.ps1");

assert.match(launcherRoute, new RegExp(`NextResponse\\.redirect\\(new URL\\("${privateAccessPath.replaceAll("/", "\\/")}"`));
assert.doesNotMatch(launcherRoute, /NextResponse\.redirect\(new URL\("\/admin-access"/);
assert.match(launcherRoute, /response\.cookies\.set\(adminEntryCookieName/);
assert.match(launcherRoute, /hasValidAdminLaunchToken\(request\.nextUrl\.searchParams\.get\("key"\)\)/);

assert.match(privateAccessPage, /hasValidAdminEntry/);
assert.match(privateAccessPage, /redirect\("\/"\)/);
assert.match(privateAccessPage, /AdminAccessPanel/);
assert.match(privateAccessPage, new RegExp(`topBarHref="${privateAccessPath.replaceAll("/", "\\/")}"`));

assert.match(publicAccessPage, /hasPrivateLauncherEntry/);
assert.ok(
  publicAccessPage.includes(`redirect(\`${privateAccessPath}\${suffix}\`)`),
  "The public admin access page should bounce valid launcher sessions back to the private access path."
);

assert.match(middleware, new RegExp(`"${launcherPath.replaceAll("/", "\\/")}"`));
assert.match(middleware, new RegExp(`"${launcherPath.replaceAll("/", "\\/")}\\/:path\\*"`));
assert.match(middleware, /X-Robots-Tag/);

assert.match(usbUpdater, /LDA_ADMIN_LAUNCH_TOKEN/);
assert.match(usbUpdater, /Open LDA Admin\.url/);
assert.match(usbUpdater, /Open LDA Admin in Chrome\.cmd/);

console.log("Admin private launcher flow checks passed.");
