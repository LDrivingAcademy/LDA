const SHORT_FEEDBACK_LIMIT = 220;
const SUMMARY_LIMIT = 320;

type FeedbackSummary = {
  text: string;
  kind: "short" | "ai" | "fallback";
};

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function trimAtWord(value: string, limit: number) {
  const cleaned = cleanText(value);
  if (cleaned.length <= limit) return cleaned;

  const candidate = cleaned.slice(0, limit + 1);
  const lastSpace = candidate.lastIndexOf(" ");
  return `${candidate.slice(0, lastSpace > limit * 0.7 ? lastSpace : limit).trimEnd()}...`;
}

function localSummary(details: string) {
  const cleaned = cleanText(details);
  const sentences = cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [cleaned];
  const firstTwo = sentences.slice(0, 2).join(" ");
  return trimAtWord(firstTwo, SUMMARY_LIMIT);
}

function extractOutputText(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "output_text" in payload &&
    typeof payload.output_text === "string"
  ) {
    return cleanText(payload.output_text.replace(/^["']|["']$/g, ""));
  }

  if (payload && typeof payload === "object" && "output" in payload && Array.isArray(payload.output)) {
    for (const item of payload.output) {
      if (!item || typeof item !== "object" || !("content" in item) || !Array.isArray(item.content)) continue;

      for (const content of item.content) {
        if (content && typeof content === "object" && "text" in content && typeof content.text === "string") {
          return cleanText(content.text.replace(/^["']|["']$/g, ""));
        }
      }
    }
  }

  return "";
}

export async function summariseProductFeedback(issue: string, details: string): Promise<FeedbackSummary> {
  const cleanedDetails = cleanText(details);

  if (cleanedDetails.length <= SHORT_FEEDBACK_LIMIT) {
    return { text: cleanedDetails, kind: "short" };
  }

  const fallback = localSummary(cleanedDetails);
  const openAiKey = process.env.OPENAI_API_KEY;
  const gatewayToken = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
  const credential = openAiKey || gatewayToken;
  if (!credential) {
    return { text: fallback, kind: "fallback" };
  }

  try {
    const useGateway = !openAiKey && Boolean(gatewayToken);
    const model = useGateway
      ? process.env.AI_FEEDBACK_MODEL || "openai/gpt-5.4"
      : process.env.OPENAI_FEEDBACK_MODEL || process.env.OPENAI_SUPPORT_MODEL || "gpt-5.2";
    const instructions =
      "Summarise product feedback for an L Driving Academy administrator. Write one plain-English sentence of 20 to 45 words. Preserve the main problem, requested change, and useful context. Do not mention the submitter, name, email, or personal identity. Do not add advice, diagnoses, headings, labels, or facts that are not in the feedback.";
    const userInput = `Issue: ${cleanText(issue)}\nFeedback: ${cleanedDetails}`;
    const body = useGateway
      ? {
          model,
          max_output_tokens: 120,
          input: [
            {
              type: "message",
              role: "user",
              content: `${instructions}\n\n${userInput}`
            }
          ]
        }
      : {
          model,
          store: false,
          max_output_tokens: 120,
          instructions,
          input: userInput
        };

    const response = await fetch(useGateway ? "https://ai-gateway.vercel.sh/v1/responses" : "https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credential}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      return { text: fallback, kind: "fallback" };
    }

    const summary = extractOutputText(await response.json());
    if (!summary) {
      return { text: fallback, kind: "fallback" };
    }

    return { text: trimAtWord(summary, SUMMARY_LIMIT), kind: "ai" };
  } catch {
    return { text: fallback, kind: "fallback" };
  }
}
