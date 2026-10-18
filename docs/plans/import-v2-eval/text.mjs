// The minimal HTML-to-text a worker would run (no DOM, no JS): drop script,
// style, noscript and template bodies, turn block tags into newlines, decode
// the common entities, collapse runs of blank space.
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", sharp: "#", flat: "b",
              ndash: "-", mdash: "-", rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', hellip: "..." };

export function htmlToText(html) {
  return String(html)
    .replace(/<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/td|\/th|\/section|\/article|p|li|h[1-6]|tr)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m)
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n[ \n]*/g, "\n")
    .trim();
}
