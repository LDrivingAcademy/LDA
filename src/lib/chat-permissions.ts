import policy from "@/lib/chat-permission-policy.json";

export type AccountAccessRole = "visitor" | "learner" | "instructor" | "in_progress" | "admin" | "support";

export type SafeChatLink = {
  label: string;
  href: string;
};

export type ChatNavigationRoute = SafeChatLink & {
  id: string;
  description: string;
  keywords: string[];
  priority: number;
  allowedRoles: AccountAccessRole[];
};

export type ChatPermissionResponse = {
  answer: string;
  nextSteps: string[];
  mode: "demo" | "live";
  safetyCritical: boolean;
  topics: string[];
  links?: SafeChatLink[];
  connectorNote?: string;
};

type ChatPermissionRoute = SafeChatLink & {
  id: string;
  description: string;
  keywords: string[];
  matchText: string;
  priority?: number;
  allowedRoles: AccountAccessRole[];
};

type ChatPolicy = {
  version: number;
  routes: ChatPermissionRoute[];
};

export type DeniedChatRoute = Pick<ChatPermissionRoute, "id" | "label" | "href">;

const chatPolicy = policy as ChatPolicy;
const routeList = chatPolicy.routes;

function normaliseHref(href: string) {
  try {
    const url = new URL(href, "https://ldrivingacademy.co.uk");
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "";
  }
}

function normaliseQuestion(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9?&=#/ -]+/g, " ").replace(/\s+/g, " ").trim();
}

function routeAllowedForRole(route: ChatPermissionRoute, role: AccountAccessRole) {
  return route.allowedRoles.includes(role);
}

function findExactPolicyRoute(href: string) {
  const normalisedHref = normaliseHref(href);

  if (!normalisedHref) {
    return null;
  }

  return routeList.find((route) => normaliseHref(route.href) === normalisedHref) ?? null;
}

function keywordScore(route: ChatPermissionRoute, question: string) {
  const searchable = [route.label, route.description, route.matchText, ...route.keywords].join(" ").toLowerCase();
  const tokens = normaliseQuestion(question).split(" ").filter((token) => token.length > 2);
  const meaningfulTokens = tokens.filter((token) => !["dashboard", "page", "area", "open"].includes(token));
  const exactPhraseScore = route.keywords.reduce((score, keyword) => {
    const phrase = keyword.toLowerCase();
    return question.includes(phrase) ? score + Math.max(4, phrase.split(/\s+/).length * 3) : score;
  }, 0);
  const tokenScore = meaningfulTokens.reduce((score, token) => (searchable.includes(token) ? score + 1 : score), 0);
  const labelScore = question.includes(route.label.toLowerCase()) ? 8 : 0;
  const hasIntentMatch = exactPhraseScore > 0 || labelScore > 0 || tokenScore >= 2;

  if (!hasIntentMatch) {
    return 0;
  }

  return exactPhraseScore + tokenScore + labelScore + (route.priority ?? 0);
}

export function getAllowedChatRoutes(role: AccountAccessRole) {
  return routeList
    .filter((route) => routeAllowedForRole(route, role))
    .map(({ id, label, href, description }) => ({ id, label, href, description }));
}

export function getNavigationIndexForRole(role: AccountAccessRole): ChatNavigationRoute[] {
  return routeList
    .filter((route) => routeAllowedForRole(route, role))
    .map((route) => ({
      id: route.id,
      label: route.label,
      href: route.href,
      description: route.description,
      keywords: route.keywords,
      priority: route.priority ?? 0,
      allowedRoles: route.allowedRoles
    }));
}

export function suggestNavigationRoutes(question: string, role: AccountAccessRole, limit = 4): SafeChatLink[] {
  return rankChatRoutes(question)
    .filter((route) => routeAllowedForRole(route, role))
    .slice(0, Math.max(1, limit))
    .map((route) => ({ label: route.label, href: route.href }));
}

export function hrefAllowedForAccount(href: string, role: AccountAccessRole) {
  const route = findExactPolicyRoute(href);
  return Boolean(route && routeAllowedForRole(route, role));
}

export function filterChatLinksForRole(links: SafeChatLink[], role: AccountAccessRole) {
  const seen = new Set<string>();

  return links.reduce<SafeChatLink[]>((allowedLinks, link) => {
    const route = findExactPolicyRoute(link.href);

    if (!route || !routeAllowedForRole(route, role)) {
      return allowedLinks;
    }

    const normalisedHref = normaliseHref(route.href);
    if (seen.has(normalisedHref)) {
      return allowedLinks;
    }

    seen.add(normalisedHref);
    allowedLinks.push({ label: route.label, href: route.href });
    return allowedLinks;
  }, []);
}

export function rankChatRoutes(question: string) {
  const normalised = normaliseQuestion(question);

  if (normalised.length < 3) {
    return [];
  }

  return routeList
    .map((route, index) => ({ route, score: keywordScore(route, normalised) - index * 0.01 }))
    .filter((match) => match.score >= 6)
    .sort((first, second) => second.score - first.score)
    .map((match) => match.route);
}

function isDirectRouteRequest(route: ChatPermissionRoute, question: string) {
  const normalised = normaliseQuestion(question);
  const label = normaliseQuestion(route.label);

  return (
    normalised.includes(label) ||
    route.keywords.some((keyword) => {
      const phrase = normaliseQuestion(keyword);
      return phrase.includes("dashboard") && normalised.includes(phrase);
    })
  );
}

function fallbackLinksForAccount(role: AccountAccessRole) {
  if (role === "learner") {
    return [
      { label: "Learner dashboard", href: "/learner-dashboard?from=chat" },
      { label: "Learner support", href: "/support/learner" }
    ];
  }

  if (role === "instructor") {
    return [
      { label: "Instructor dashboard", href: "/instructor-dashboard?from=chat" },
      { label: "Instructor support", href: "/support/instructor" }
    ];
  }

  if (role === "in_progress") {
    return [
      { label: "Instructor verification", href: "/instructor-verification?from=chat" },
      { label: "Instructor support", href: "/support/instructor" }
    ];
  }

  if (role === "visitor") {
    return [
      { label: "Log in", href: "/auth/login?from=chat" },
      { label: "Create an account", href: "/auth/sign-up?from=chat" },
      { label: "Guest support", href: "/support/guest" }
    ];
  }

  if (role === "admin") {
    return [
      { label: "Technical support", href: "/technical-support" }
    ];
  }

  return [];
}

function buildAccountRestrictionResponse(role: AccountAccessRole): ChatPermissionResponse {
  return {
    answer: role === "visitor"
      ? "Sign in to open that page. If you need help first, use learner support."
      : "I can't open that page from here. Use the button below for the best available next step.",
    nextSteps: [
      "Open the available page below, or ask for learner help, instructor help, booking help, or account help."
    ],
    mode: "demo",
    safetyCritical: false,
    topics: ["Next step"],
    links: fallbackLinksForAccount(role)
  };
}

export function buildRouteChatResponse(question: string, _currentPath: string, role: AccountAccessRole) {
  const routeMatches = rankChatRoutes(question);

  if (!routeMatches.length) {
    return null;
  }

  const primaryMatch = routeMatches[0];
  const allowedMatches = routeMatches.filter((route) => routeAllowedForRole(route, role));
  const primaryRoute = allowedMatches[0] ?? primaryMatch;

  if (!allowedMatches.length || (!routeAllowedForRole(primaryMatch, role) && isDirectRouteRequest(primaryMatch, question))) {
    return {
      response: buildAccountRestrictionResponse(role),
      deniedRoute: {
        id: primaryMatch.id,
        label: primaryMatch.label,
        href: primaryMatch.href
      }
    };
  }

  const allowedLinks = allowedMatches
    .slice(0, 4)
    .map((route) => ({ label: route.label, href: route.href }));

  return {
    response: {
      answer: `Open ${primaryRoute.label}. ${primaryRoute.description}`,
      nextSteps: [],
      mode: "demo",
      safetyCritical: false,
      topics: [primaryRoute.label],
      links: allowedLinks
    } satisfies ChatPermissionResponse,
    deniedRoute: null
  };
}

export function chatPermissionPolicyVersion() {
  return chatPolicy.version;
}
