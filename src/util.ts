export const VALID_QUOTELESS_STRING_RE = /^[A-Za-z][A-Za-z0-9]*$/;
export const VALID_QUOTELESS_KEY_RE = /^[A-Za-z][A-Za-z_0-9\+\-\.\_]*$/;

export function stringifyTextEscaped(text: string, quotelessRegex: RegExp) {
  if (quotelessRegex.test(text)) return text;
  return `"${text.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

export function stringifyByte(byte: number): string {
  return `0x${byte.toString(16).padStart(2, "0")}`;
}
