export const redactPatterns = (text) =>
  String(text)
    .replace(/:\/\/[^\s/]*@/g, "://[redacted]@")
    .replace(/eyJ[\w-]{5,}\.[\w-]{5,}\.[\w-]{3,}/g, "[redacted-token]")
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[redacted-email]");

export const redact = (text, secrets = []) => {
  let out = String(text);
  for (const s of secrets) out = out.split(s).join("[redacted]");
  return redactPatterns(out);
};
