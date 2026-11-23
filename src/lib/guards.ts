// Narrowing for untrusted input (request bodies, provider responses, localStorage).

export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** The string at `key` of an untrusted value, or '' when there is none. */
export const textAt = (value: unknown, key: string): string => {
  const field = isRecord(value) ? value[key] : undefined;
  return typeof field === 'string' ? field : '';
};
