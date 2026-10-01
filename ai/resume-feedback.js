const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

function inputText(value, label, maximum) {
  if (typeof value !== "string") {
    throw { status: 400, message: `${label} must be text.` };
  }
  const text = value.trim();
  if (!text) throw { status: 400, message: `Please enter your ${label.toLowerCase()}.` };
  if (text.length > maximum) throw { status: 400, message: `${label} must be ${maximum.toLocaleString("en-CA")} characters or fewer.` };
  return text;
}

function responseText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();
  for (const item of payload?.output || []) {
    for (const part of item?.content || []) {
      if (part?.type === "output_text" && typeof part.text === "string" && part.text.trim()) return part.text.trim();
    }
  }
  return "";
}

function createResumeFeedbackHandler({ config, limiter, fetch: request = globalThis.fetch }) {
  return async (data, requestContext) => {
    if (!config.openAiApiKey) {
      throw { status: 503, message: "Resume feedback is not configured yet. Please ask the site administrator to add the OpenAI API key." };
    }
    if (typeof request !== "function") {
      throw { status: 503, message: "Resume feedback is unavailable on this server. Please try again later." };
    }

    const resumeText = inputText(data.resumeText, "Resume text", 8000);
    const targetRole = data.targetRole === undefined || data.targetRole === "" ? "a role you are applying for" : inputText(data.targetRole, "Target role", 120);
    limiter.check(`resume-feedback:${requestContext.socket.remoteAddress || "unknown"}`);
    let upstream;
    try {
      upstream = await request(OPENAI_RESPONSES_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.openAiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.openAiModel,
          instructions: "You are a careful career coach. Give concise, constructive resume feedback. Do not invent experience. Use plain text with these headings: Strengths, Improvements, Tailoring. Keep the answer under 500 words.",
          input: `Target role: ${targetRole}\n\nResume:\n${resumeText}`,
        }),
      });
    } catch {
      throw { status: 503, message: "Resume feedback is temporarily unavailable. Please try again later." };
    }
    if (!upstream.ok) {
      if (upstream.status === 401 || upstream.status === 403) console.error("OpenAI rejected the resume-feedback credentials.");
      else console.error(`OpenAI resume-feedback request failed with status ${upstream.status}.`);
      throw { status: 503, message: "Resume feedback is temporarily unavailable. Please try again later." };
    }
    let payload;
    try {
      payload = await upstream.json();
    } catch {
      throw { status: 503, message: "Resume feedback returned an unreadable response. Please try again later." };
    }
    const feedback = responseText(payload);
    if (!feedback) throw { status: 503, message: "Resume feedback returned no advice. Please try again later." };
    return { status: 200, feedback };
  };
}

module.exports = { createResumeFeedbackHandler };
