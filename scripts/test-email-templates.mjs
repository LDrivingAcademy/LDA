import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildPasswordResetEmail, renderLdaEmail } from "../src/lib/email.ts";
import { createFollowLdaWelcomeEmailContent } from "../src/lib/follow-lda-welcome-email.ts";

const samples = [
  renderLdaEmail(createFollowLdaWelcomeEmailContent()),
  buildPasswordResetEmail({
    to: "learner@example.com",
    role: "learner",
    confirmUrl: "https://ldrivingacademy.co.uk/auth/confirm?token_hash=preview&type=recovery"
  }).html,
  renderLdaEmail({
    subject: "LDA booking confirmed",
    title: "Your LDA lesson is confirmed",
    eyebrow: "Booking confirmed",
    intro: "Your lesson is confirmed.",
    ctaLabel: "Open booking",
    ctaUrl: "https://ldrivingacademy.co.uk/learner-dashboard"
  })
];

for (const html of samples) {
  assert.match(html, /data-lda-email-shell="true"/);
  assert.match(html, /lda-email-logo-v1\.jpg/);
  assert.match(html, /background:#050505/);
  assert.match(html, /<td align="left">\s*<img[\s\S]*?class="lda-email-logo"/);
  assert.doesNotMatch(html, /<td align="right">\s*<img[\s\S]*?class="lda-email-logo"/);
  assert.match(html, /Kind regards,/);
  assert.match(html, /L Driving Academy team/);
  assert.match(html, /@media only screen and \(max-width: 480px\)/);
  assert.doesNotMatch(html, />\s*(?:Hello|Hi|Dear)\b/i);
}

const passwordReset = buildPasswordResetEmail({
  to: "learner@example.com",
  role: "learner",
  confirmUrl: "https://ldrivingacademy.co.uk/auth/confirm?token_hash=preview&type=recovery"
});

assert.match(passwordReset.text, /Reset password \(https:\/\/ldrivingacademy\.co\.uk\/auth\/confirm/);
assert.match(passwordReset.text, /L Driving Academy team/);

const authActions = await readFile(new URL("../src/app/auth/actions.ts", import.meta.url), "utf8");
assert.doesNotMatch(authActions, /resetPasswordForEmail/);

const emailSource = await readFile(new URL("../src/lib/email.ts", import.meta.url), "utf8");
assert.doesNotMatch(emailSource, /(?:>|["'`])\s*Hello(?:\s+there)?[,\s<]/i);
assert.doesNotMatch(emailSource, /<p[^>]*>\s*(?:Hi|Dear)\b/i);
assert.equal((emailSource.match(/https:\/\/api\.resend\.com\/emails/g) ?? []).length, 1);

console.log("LDA email template tests passed.");
