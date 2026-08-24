export function extractJson<T>(raw: string): T {
  const clean = raw.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(clean) as T;
  } catch {
    // A response that doesn't end with '}' or ']' almost always means it
    // hit the token limit mid-output, not that the model wrote malformed
    // JSON — same diagnostic run-workflow.ts's publishToWordPress
    // extraction already uses, worth saying plainly rather than leaving a
    // bare JSON.parse to throw its generic "Unexpected end of JSON input".
    const likelyTruncated = !clean.endsWith('}') && !clean.endsWith(']');
    throw new Error(
      `extractJson: response was not valid JSON` +
        (likelyTruncated ? ' (likely truncated — response did not end with "}" or "]")' : '') +
        `. Length: ${clean.length}. Tail: ${clean.slice(-500)}`
    );
  }
}
