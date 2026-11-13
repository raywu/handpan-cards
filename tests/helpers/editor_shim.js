/* Drives the new editor's save and delete pipeline in the sandbox, which has no DOM tree
 * for the editor panel. editorOpen is swapped for a DOM-free twin that builds the same
 * session from the same model functions. Five handles stand in for the editor's controls:
 * scale-box and scale-name are the line and the name field (document.getElementById maps
 * editor-line and editor-name onto them), scale-generate runs the real editorSave,
 * scale-delete arms and confirms the delete, scale-swatches picks a palette, scale-neotone switches the pan type. The editor's
 * DOM half is covered in the browser by tests/editor_e2e.test.js. */
const SHIM = `(() => {
  const el = (id) => document.getElementById(id);
  const alias = { "editor-line": "scale-box", "editor-name": "scale-name" };
  const lookup = document.getElementById.bind(document);
  document.getElementById = (id) => lookup(alias[id] || id);
  editorOpen = function (edit) {
    const kind = !edit ? "new" : seeded() ? "builtin" : "saved";
    const model = editorModelFor(edit, kind);
    const failed = model.ok === false;
    const start = failed ? editorEmptyModel() : model;
    editorSession = { history: editorHistoryNew(start), base: start, editing: false, error: failed ? reasonText(model) : "",
      notice: false, saving: false, dialog: false, held: null, sel: null, zone: null, say: "", tab: "scale", menu: false, naming: false, nameTouched: false };
    el("scale-box").value = failed || !edit ? "" : editorLineText(start);
    el("scale-name").value = start.options.name || "";
    el("scale-delete").armed = false;
    el("scale-neotone").checked = editorKindOf(start) === "neotone";
  };
  editorClose = function () { editorSession = null; };
  editorRender = function () {};
  runGenerate = el("scale-generate").onclick = function () {
    const s = editorSession;
    if (!s) return;
    s.editing = true;
    s.naming = true;
    return editorSave();
  };
  /* The editor saves a built-in as a new scale (D15), so the editor cannot make a seeded
   * replacement. Older releases stored them, so the data layer still honours the command;
   * this commits it the way the retired sheet did. */
  replaceBuiltin = async function () {
    const s = editorSession, base = editingBase, m = s.history.present;
    const built = buildGenerated(HPE.core.formatSeed(m.fields), { ...editorCommitOptions(m), name: m.options.name || base.deck.name });
    const candidate = { record: scaleRecord(seedOf(built.value)), deck: built.value };
    const result = await commitSaved({ type: "replace-builtin", seedId: base.selection.id, expectedSlotStateRevision: base.slotStateRevision,
      expectedOwnerId: base.ownerId, collectionId: base.collectionId, candidate });
    if (result.ok) { closeScaleSheet(); selectDeck({ kind: "saved", id: result.instanceId }, false); }
    return result;
  };
  el("scale-delete").onclick = function () {
    const b = el("scale-delete");
    if (!editorSession || !editingId) return;
    if (b.armed) {
      b.armed = false;
      if (wouldEmpty(editingId)) { editorSession.error = t("sheet.del_refusal", { name: editedDeck().name }); return; }
      return deleteDeck(editingId);
    }
    b.armed = true;
  };
  el("scale-swatches").children = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => ({ click() { editorPickPalette(i); } }));
  neotoneOn = () => !!editorSession && editorKindOf(editorSession.history.present) === "neotone";
  el("scale-neotone").onchange = function () {
    const s = editorSession;
    if (s && el("scale-box").value.trim() && editorIsEmpty(s.history.present)) { s.editing = true; editorCommitLine(); }
    editorSetPanType(this.checked ? "neotone" : "standard"); };
  Object.defineProperty(el("scale-generate"), "disabled", { configurable: true, get() {
    const s = editorSession;
    if (!s || s.saving) return true;
    const typed = el("scale-box").value, m = s.history.present;
    if (typed.trim() && typed.trim() !== editorLineText(m)) return !editorLoad(typed, m.options).ok;
    return !!s.error || !editorCanSave(m);
  }, set() {} });
  Object.defineProperty(el("scale-refusal"), "textContent", { configurable: true, get() { return editorSession ? editorSession.error || "" : ""; }, set() {} });
  Object.defineProperty(el("scale-msg"), "textContent", { configurable: true, get() { return editorSession ? editorSession.error || "" : ""; }, set() {} });
  el("scale-back").onclick = function () { closeScaleSheet(); };
})();`;

function install(app) {
  app.run(SHIM);
  return app;
}

module.exports = { install, SHIM };
