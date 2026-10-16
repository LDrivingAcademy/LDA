import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { renderLdaEmail } from "../src/lib/email.ts";
import { createFollowLdaWelcomeEmailContent } from "../src/lib/follow-lda-welcome-email.ts";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const outputDirectory = resolve(scriptDirectory, "../.codex/email-previews");
const outputPath = resolve(outputDirectory, "follow-lda-subscription.html");
const logoSourcePath = resolve(scriptDirectory, "../public/lda-email-logo-v1.jpg");
const logoPreviewPath = resolve(outputDirectory, "lda-email-logo-v1.jpg");

await mkdir(outputDirectory, { recursive: true });
await copyFile(logoSourcePath, logoPreviewPath);
await writeFile(
  outputPath,
  renderLdaEmail(createFollowLdaWelcomeEmailContent()).replace(
    "https://ldrivingacademy.co.uk/lda-email-logo-v1.jpg",
    "./lda-email-logo-v1.jpg"
  ),
  "utf8"
);

console.log(outputPath);
