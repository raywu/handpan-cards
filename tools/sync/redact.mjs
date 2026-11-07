export const redactPatterns = (text) =>
  String(text)
    .replace(/eyJ[\w-]{5,}\.[\w-]{5,}\.[\w-]{3,}/g, "[redacted-token]")
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[redacted-email]")
    .replace(/:\/\/[^\s@/]*@/g, "://[redacted]@");

export const redact = (text, secrets = []) => {
  let out = String(text);
  for (const s of secrets) out = out.split(s).join("[redacted]");
  return redactPatterns(out);
};
