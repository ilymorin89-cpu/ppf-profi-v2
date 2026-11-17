export const MAX_REQUEST_INPUT_BYTES = 48 * 1024;

/**
 * Measure the complete model-controlled input surface before a Responses API call.
 * JSON serialization intentionally includes instructions, structured input, tool
 * schemas, property names and framing. The byte limit is a conservative ceiling.
 */
export function measureRequestInputBytes({ instructions, input, tools }) {
  if (typeof instructions !== "string" || !instructions.trim()) {
    throw new TypeError("Model instructions must be a non-empty string.");
  }
  if (!Array.isArray(tools)) throw new TypeError("Model tools must be an array.");
  let serialized;
  try { serialized = JSON.stringify({ instructions, input, tools }); }
  catch { throw new TypeError("Model request input must be JSON-serializable."); }
  if (typeof serialized !== "string") throw new TypeError("Model request input must be JSON-serializable.");
  return Buffer.byteLength(serialized, "utf8");
}

export function assertRequestInputWithinLimit(payload) {
  const bytes = measureRequestInputBytes(payload);
  if (bytes > MAX_REQUEST_INPUT_BYTES) {
    throw new RangeError("Model request input is " + bytes + " UTF-8 bytes; hard limit is " + MAX_REQUEST_INPUT_BYTES + ". No provider request was sent.");
  }
  return bytes;
}
