const OFF = "const ONE_PANEL = false;";
const ON = "const ONE_PANEL = true ;";
const LINE = /const ONE_PANEL = (?:true |false);/g;

function apply(bytes, on) {
  const text = String(bytes);
  const hits = text.match(LINE) || [];
  if (hits.length !== 1) throw new Error(`editor_flag: expected exactly one ONE_PANEL line, found ${hits.length}`);
  const out = text.replace(LINE, () => (on ? ON : OFF));
  if (out.length !== text.length) throw new Error("editor_flag: substitution changed the byte length");
  return out;
}

module.exports = { apply, OFF, ON };
