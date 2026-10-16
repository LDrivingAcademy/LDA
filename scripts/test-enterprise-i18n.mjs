import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

const layout = read("src/app/layout.tsx");
const homePage = read("src/app/page.tsx");
const selector = read("src/components/language-selector.tsx");
const translator = read("src/components/page-translator.tsx");
const qaMode = read("src/components/i18n-qa-mode.tsx");
const i18nConfig = read("src/lib/i18n/config.ts");
const messages = read("src/lib/i18n/messages/en-GB.ts");
const messageApi = read("src/lib/i18n/messages.ts");
const supportRoute = read("src/app/api/support/assistant/route.ts");
const css = read("src/app/globals.css");
const mainMenu = read("src/components/main-menu.tsx");

assert(layout.includes("<PageTranslator />"), "Global page translator must remain mounted.");
assert(layout.includes("<I18nQaMode />"), "Language QA mode must be mounted globally.");
assert(layout.includes("readCookie(\"${localeCookieName}\")"), "Layout bootstrap must read the locale cookie before hydration.");
assert(selector.includes("writeLanguageCookie(localeCookieName"), "Language selector must persist the selected locale to a cookie.");
assert(selector.includes("lda-language-change"), "Language selector must dispatch language-change events.");
assert(selector.includes("Search"), "Language selector must include searchable behaviour.");
assert(selector.includes("role=\"listbox\""), "Language selector dropdown must use accessible listbox semantics.");
assert(selector.includes("role=\"option\""), "Language selector dropdown must expose accessible options.");
assert(selector.includes("aria-selected={isActive}"), "Language selector must mark the active language for assistive tech.");
assert(selector.includes("<Check"), "Language selector must show a checkmark for the active language.");
assert(selector.includes("overflow-y-auto overflow-x-hidden"), "Language selector menu must scroll vertically and prevent horizontal overflow.");
assert(selector.includes("truncate"), "Language selector must constrain long language names without layout shift.");
assert(selector.includes("max-w-[calc(100vw-2rem)]"), "Inline language selector must stay within the viewport.");
assert(selector.includes("menuBounded"), "Language selector must support bounded use inside small-screen menus.");
assert(selector.includes("left-0 right-0 w-full max-w-full"), "Menu-bounded selector must lock dropdown width to the menu.");
assert(selector.includes("setOpen(false)"), "Language selector must close after a normal language selection.");
assert(selector.includes("isRtlLanguage(value, \"\")"), "Language selector must apply RTL direction for RTL languages.");
assert(selector.includes("data-lda-locale"), "Language selector must update document locale metadata without leaving the page.");
assert(messages.includes("\"language.selector.searchPlaceholder\""), "Language selector search copy must be externalized.");
assert(messages.includes("\"language.selector.noResults\""), "Language selector empty search copy must be externalized.");
assert(mainMenu.includes("<LanguageSelector menuBounded />"), "Small-screen navigation menu must keep the language selector bounded.");
assert(homePage.includes("<LanguageSelector />"), "Public desktop header language selector placement must remain unchanged.");
assert(homePage.includes("hidden items-center justify-end gap-7 xl:flex"), "Public large-screen header layout baseline must remain locked.");
assert(mainMenu.includes("w-[min(92vw,18rem)] overflow-hidden"), "Small-screen menu width and clipping baseline must remain locked.");
assert(translator.includes("restoreEnglish"), "Translator must preserve and restore the English baseline.");
assert(translator.includes("lda-i18n-translated"), "Translator must notify QA checks after translation.");
assert(i18nConfig.includes("defaultLocale = \"en-GB\""), "English UK must be the default protected locale.");
assert(i18nConfig.includes("getLocaleFromRequest"), "Server APIs must have a shared locale detector.");
assert(i18nConfig.includes("describeLocale"), "Locale descriptors must include language metadata for AI prompts.");
assert(messageApi.includes("getEnglishMessage"), "English catalog accessor must be available.");
assert(messages.includes("\"ai.greeting\""), "AI greeting must be externalized.");
assert(messages.includes("\"language.selector.label\""), "Language selector copy must be externalized.");
assert(supportRoute.includes("Reply in the user's language"), "Support AI must be instructed to answer in the user's language.");
assert(supportRoute.includes("getLocaleFromRequest(request)"), "Support AI route must detect the locale from the request.");
assert(supportRoute.includes("languageDirection"), "Support AI audit metadata must include language direction.");
assert(css.includes("--lda-space-xs"), "Design spacing tokens must exist.");
assert(css.includes("--lda-text-measure"), "Design typography/measure tokens must exist.");
assert(css.includes("html[dir=\"rtl\"]"), "RTL layout support must exist.");
assert(css.includes("data-i18n-overflow"), "QA overflow marker styles must exist.");
assert(qaMode.includes("lda-i18n-qa-complete"), "QA mode must emit machine-readable overflow results.");
assert(qaMode.includes("scrollWidth > element.clientWidth"), "QA mode must check horizontal overflow.");
assert(qaMode.includes("scrollHeight > element.clientHeight"), "QA mode must check vertical overflow.");

if (failures.length) {
  console.error("Enterprise i18n checks failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Enterprise i18n checks passed.");
