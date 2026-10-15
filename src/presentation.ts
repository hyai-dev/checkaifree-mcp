export function presentReading(data: {status?: string; result?: {ai_probability?: number; verdict?: string}; signals?: Array<{code?: string}>}) {
  const codes = new Set(data.signals?.map(s => s.code));
  const score = data.result?.ai_probability;
  const unavailable = codes.has("classifier_unavailable") || data.status === "failed";
  const model = data.status === "completed" && !unavailable && codes.has("pixel_classifier") && typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= 1;
  const invalidModel = codes.has("pixel_classifier") && !model;
  const verdict = unavailable || invalidModel ? "uncertain" : data.result?.verdict;
  const label = verdict === "ai_likely" ? (model ? "Model suggests AI generation" : "Source text suggests AI generation") : verdict === "human_likely" ? (model ? "Model suggests a non-AI image" : "Camera metadata found; origin not authenticated") : "Inconclusive";
  return { label, score: model ? `${Math.round(score * 100)}% model score (not a calibrated probability)` : "No completed model score; source clues alone do not establish a probability" };
}
