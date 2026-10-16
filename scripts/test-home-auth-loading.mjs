import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const accountControls = read("src/components/home-account-controls.tsx");
const heroActions = read("src/components/home-hero-actions.tsx");
const suggestionGrid = read("src/components/home-suggestion-grid.tsx");
const smartMatchLink = read("src/components/home-smart-match-link.tsx");

assert.match(accountControls, /useState<HeaderAccountSummary \| null \| undefined>\(undefined\)/);
assert.match(accountControls, /account === undefined/);
assert.match(accountControls, /bg-white\/10/);

assert.match(heroActions, /useState<HeaderAccountSummary \| null \| undefined>\(undefined\)/);
assert.match(heroActions, /isLoadingAccount = account === undefined/);
assert.match(heroActions, /aria-hidden="true"/);

assert.match(suggestionGrid, /useState<HeaderAccountSummary \| null \| undefined>\(undefined\)/);
assert.match(suggestionGrid, /isLoadingAccount = account === undefined/);
assert.match(suggestionGrid, /min-h-\[220px\]/);

assert.match(smartMatchLink, /useState<HomeAccountSummary \| null \| undefined>\(undefined\)/);
assert.match(smartMatchLink, /account === undefined/);
assert.match(smartMatchLink, /<span/);

console.log("Home auth loading checks passed.");
