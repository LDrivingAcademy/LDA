import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { buildPasswordResetEmail } from "../src/lib/email.ts";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const outputDirectory = resolve(scriptDirectory, "../.codex/email-previews");
const outputPath = resolve(outputDirectory, "password-reset.html");
const logoSourcePath = resolve(scriptDirectory, "../public/lda-email-logo-v1.jpg");
const logoPreviewPath = resolve(outputDirectory, "lda-email-logo-v1.jpg");

const email = buildPasswordResetEmail({
  to: "learner@example.com",
  role: "learner",
  confirmUrl: "https://ldrivingacademy.co.uk/auth/confirm?token_hash=preview&type=recovery"
});

await mkdir(outputDirectory, { recursive: true });
await copyFile(logoSourcePath, logoPreviewPath);
await writeFile(
  outputPath,
  email.html.replace(
    "https://ldrivingacademy.co.uk/lda-email-logo-v1.jpg",
    "./lda-email-logo-v1.jpg"
  ),
  "utf8"
);

console.log(outputPath);
