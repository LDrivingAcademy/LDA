import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const component = read("src/components/support-assistant.tsx");
const route = read("src/app/api/support/assistant/route.ts");
const guidance = read("src/lib/support-guidance.ts");

assert.match(component, /I haven’t been able to resolve this\. I can create a ticket for the LDA support team\. Would you like updates by email\?/);
assert.match(component, /Yes, send email updates/);
assert.match(component, /No, create without email/);
assert.match(component, /Continue without email/);
assert.match(component, /emailUpdates: EmailUpdatesPreference/);
assert.match(component, /"accepted", email/);
assert.match(component, /"declined", ""/);
assert.doesNotMatch(component, /audience === "guest" \|\| needsEmailForEscalation/);
assert.doesNotMatch(component, /Email for updates if LDA needs to escalate/);

assert.match(route, /emailUpdates\?: "accepted" \| "declined" \| "unknown"/);
assert.match(route, /emailUpdates === "declined"\s*\?\s*""/);
assert.match(route, /contact_email: contactEmail \|\| null/);
assert.match(route, /canCreateTicket: true/);
assert.match(route, /needsEmail: false/);
assert.doesNotMatch(route, /Enter an email address so LDA can update you about the ticket/);
assert.match(route, /if \(contactEmail\) \{/);
assert.match(route, /No email updates will be sent/);

assert.doesNotMatch(guidance, /details\.push\("email address for ticket updates"\)/);

console.log("Support email escalation checks passed.");
