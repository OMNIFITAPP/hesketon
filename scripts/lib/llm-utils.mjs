// ============================================================
//  Shared LLM plumbing: JSON extraction/repair + model quirks.
//  Used by the analyst, writer, claims and quotes passes.
// ============================================================

/**
 * Newer models (Opus 4.7/4.8, Sonnet 5, Fable/Mythos 5) reject the
 * `temperature` parameter outright (400). Only send it to models that
 * still accept it.
 */
export function supportsTemperature(model) {
  return !/opus-4-[78]|sonnet-5|fable|mythos/.test(model || '');
}

/** Best-effort JSON extraction from a model's reply (object or array). */
export function parseModelJson(text) {
  let raw = (text || '').trim();

  // Strip a ```json … ``` fence. Tolerate a *missing* closing fence (which is
  // exactly what truncated output looks like) by matching the opener alone.
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) raw = fenced[1].trim();
  else raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // Take from the first { or [ onward (drop any prose preamble).
  const start = raw.search(/[{[]/);
  if (start > 0) raw = raw.slice(start);

  // Happy path: trim to the outermost balanced close and parse.
  const end = Math.max(raw.lastIndexOf('}'), raw.lastIndexOf(']'));
  const balanced = end !== -1 ? raw.slice(0, end + 1) : raw;
  try {
    return JSON.parse(balanced);
  } catch {
    /* fall through to repair */
  }

  // Repair path: output was cut off mid-JSON (token ceiling).
  try {
    return JSON.parse(repairTruncatedJson(raw));
  } catch {
    throw new Error('Could not parse the model output as JSON.\n--- first 800 chars ---\n' + text.slice(0, 800));
  }
}

/** Best-effort close of a JSON string/object/array tree that was cut off. */
export function repairTruncatedJson(raw) {
  const stack = [];
  let inString = false;
  let escaped = false;

  for (const ch of raw) {
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{' || ch === '[') stack.push(ch);
    else if (ch === '}' || ch === ']') stack.pop();
  }

  let out = raw;
  if (inString) out += '"';
  // Drop a dangling trailing comma / partial key before closing.
  out = out.replace(/,\s*$/, '').replace(/:\s*$/, ': null');
  for (let i = stack.length - 1; i >= 0; i--) out += stack[i] === '{' ? '}' : ']';
  return out;
}
