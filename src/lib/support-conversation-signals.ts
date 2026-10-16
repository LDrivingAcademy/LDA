const unresolvedSupportPattern =
  /\b(i\s+)?(tried|done|did)\s+(that|this|it)\b.*\b(still|not|didn'?t|doesn'?t|failed|broken)\b|\bstill\s+(not\s+|isn'?t\s+|is\s+not\s+)?(working|fixed|missing|stuck|wrong|resolved|solved)\b|\bnot\s+fixed\b|\bisn'?t\s+fixed\b|\bdidn'?t\s+solve\b|\bthat\s+didn'?t\s+work\b|\bthat\s+did\s+not\s+solve\b|\bi\s+still\s+need\s+help\b/i;

export function isNaturalUnresolvedSupportMessage(message: string) {
  return unresolvedSupportPattern.test(message);
}
