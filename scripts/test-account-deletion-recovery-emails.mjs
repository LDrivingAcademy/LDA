import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const emailSource = readFileSync(join(root, "src", "lib", "email.ts"), "utf8");
const erasureSource = readFileSync(join(root, "src", "lib", "account-erasure.ts"), "utf8");
const recoveryRouteSource = readFileSync(join(root, "src", "app", "account", "recover-deleted", "route.ts"), "utf8");

assert.match(emailSource, /sendAccountDeletionScheduledEmail/);
assert.match(emailSource, /We’re sorry to see you go/);
assert.match(emailSource, /Thank you for using L Driving Academy/);
assert.match(emailSource, /You have 30 days to restart your account/);
assert.match(emailSource, /Restart Account/);
assert.match(emailSource, /paid LDA subscription connected to this account is cancelled/);
assert.match(emailSource, /After 30 days, LDA will permanently delete or anonymise/);

assert.match(emailSource, /sendAccountDeletionRecoveredEmail/);
assert.match(emailSource, /Welcome back to LDA/);
assert.match(emailSource, /Account restarted/);
assert.match(emailSource, /pick up from where you left off/);
assert.match(emailSource, /billing will not restart automatically/);
assert.match(emailSource, /Sign in to LDA/);

assert.match(erasureSource, /sendAccountDeletionRecoveredEmail/);
assert.match(erasureSource, /sendAccountDeletionScheduledEmail/);
assert.match(erasureSource, /sendSubscriptionCancellationEmail/);
assert.match(erasureSource, /cancelStripeSubscription/);
assert.match(erasureSource, /getStripeSecretKey/);
assert.match(erasureSource, /cancelDeletionSubscription/);
assert.match(erasureSource, /clearAccountDeletionAuthBan/);
assert.match(erasureSource, /ban_duration:\s*"none"/);
assert.match(erasureSource, /banned_until/);
assert.match(erasureSource, /Supabase did not clear the account ban/);
assert.match(erasureSource, /signInUrl: origin \? new URL\("\/auth\/login", origin\)\.toString\(\) : undefined/);
assert.match(erasureSource, /account-recovered:\$\{payload\.userId\}:\$\{expiresAt\}/);

assert.match(recoveryRouteSource, /recoverScheduledAccountDeletion\(\{ admin, token, origin: url\.origin \}\)/);

console.log("Account deletion and restart email regression checks passed.");
