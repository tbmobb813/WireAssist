export function extractJson<T>(raw: string): T {
  const clean = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(clean) as T;
}
