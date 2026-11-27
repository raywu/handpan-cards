/* The inventory of every message the editor writes to #editor-status, derived from the writers
 * (docs/plans/2026-11-16-so-regroup.md "Inventory"). ROWS drives the landscape readability matrix in
 * tests/editor_e2e.test.js; tests/editor_shell.test.js keeps ROWS, EXCLUDED and the i18n tables in step. */
const LONG_NAME = "Celtic Minor Kurd Integral Mutant D3 10n";

const DRIFT = /^(reason\.|editor\.(say\.|full\.|neo\.|crowded$|empty$|dragging$|rebound$|held$|seats_reset$|pins_reset$|ding_bottom_only$)|sheet\.(del_refusal|del_note_seeded|del_note_custom|cannot_trade)$|saved\.)/;

const VALUES = { A: "C#4", B: "D3", N: "5.5", X: "C#4", a: "C#4", b: "Bb3", angle: "123", ding: "D3", fifth: "A3", floor: "6", max: "12", n: 12,
  name: "C#4", new: "C#4", old: "Bb3", pt: "5.50", seat: "Kurd 9", step: "5", token: "C#44x", zone: "inner" };
const NAMED = /^(sheet\.|editor\.rebound$)/;

const ERROR = [
  "reason.NEOTONE_INPUT", "reason.NO_DING", "reason.NO_DING.which", "reason.NO_DING.two", "reason.NO_DING.below", "reason.NO_FIFTH",
  "reason.BAD_NOTE", "reason.BAD_NOTE.innerLabelRoom", "reason.BAD_NOTE.slash", "reason.BAD_NOTE.bracket", "reason.BAD_NOTE.bar", "reason.BAD_NOTE.barEmpty", "reason.BAD_NOTE.barFirst",
  "reason.NOTE_OUT_OF_RANGE", "reason.NOTE_OUT_OF_ORDER", "reason.NOTE_OUT_OF_ORDER.ding", "reason.NOTE_REPEATED", "reason.NEEDS_NEWER_APP", "reason.NO_THIRDS",
  "reason.PROFILE_UNKNOWN", "reason.PROFILE_MAP_INVALID", "reason.PROFILE_NOTE_MISSING", "reason.PROFILE_NOTE_TWICE", "reason.PROFILE_FULL", "reason.PROFILE_CONFLICT",
  "reason.SMALL_LABELS", "sheet.cannot_trade",
  "editor.full.rim", "editor.full.inner", "editor.full.bottom", "editor.crowded", "editor.say.no_room", "editor.say.zone_is_full",
  "editor.pitch_repeat", "editor.guided.no_room", "editor.guided.pins", "editor.switch_cyclops",
  "editor.say.ding_required", "editor.say.rim_min", "sheet.toggle_refused", "editor.neo.field_empty", "editor.neo.own_row", "editor.ding_bottom_only", "editor.empty",
  "saved.failure", "saved.ackPending", "saved.sessionAckPending",
];
const PLAIN = [
  "sheet.del_refusal", "sheet.del_note_seeded", "sheet.del_note_custom", "editor.rebound", "editor.say.del_kept",
  "editor.say.picked", "editor.say.zone_inner", "editor.say.zone_bottom", "editor.say.ding_stays", "editor.say.same_zone", "editor.say.went_back",
];
const UNDO = [
  "editor.say.swapped", "editor.say.ding_swap", "editor.say.ding_replace", "editor.say.replaced", "editor.say.removed", "editor.say.went_back",
  "editor.say.placed", "editor.say.added", "editor.say.moved", "editor.say.nudged", "editor.say.picked", "editor.say.zone_inner", "editor.say.zone_bottom",
  "editor.say.ding_stays", "editor.say.same_zone", "editor.say.ding_first", "editor.seats_reset",
];
const UNDO_EMPTY = ["editor.say.removed", "editor.say.ding_swap", "editor.say.placed", "editor.pins_reset", "editor.seats_reset"];
const HELD = ["editor.held"];
const IDLE = ["editor.empty", "editor.say.stage_need_ding", "editor.say.stage_need_fifth"];
const DRAG = ["editor.dragging"];

const varsOf = (k) => ({ ...VALUES, name: NAMED.test(k) ? LONG_NAME : VALUES.name });
const rows = (mode, keys) => keys.map((k) => ({ k, mode, vars: varsOf(k) }));
const ROWS = [
  ...rows("error", ERROR), ...rows("plain", PLAIN), ...rows("undo", UNDO), ...rows("undo-empty", UNDO_EMPTY),
  ...rows("held", HELD), ...rows("idle", IDLE), ...rows("drag", DRAG),
];

const EXCLUDED = {
  "saved.temporary": "button label in the saved-scales menu status",
  "saved.session": "#saved-status in the menu (updateSavedStatus)",
  "saved.recovery": "#saved-status in the menu (updateSavedStatus)",
  "saved.legacy": "#saved-status in the menu (updateSavedStatus)",
  "saved.newer.one": "#saved-status in the menu (updateSavedStatus)",
  "saved.newer.other": "#saved-status in the menu (updateSavedStatus)",
  "saved.savedToken": "an accessible name of a scale chip, not a status",
  "saved.presetToken": "an accessible name of a scale chip, not a status",
  "saved.importFailure": "the app-level say() line outside the editor",
  "saved.resetFailure": "the app-level say() line outside the editor",
  "saved.resetConflict": "the app-level say() line outside the editor",
  "saved.sessionImportAckPending": "the import path writes the app-level say() line, never #editor-status",
  "editor.neo.pair_help": "a line in the Neotone Layout panel, not #editor-status",
  "editor.neo.builtin": "a line in the Neotone Layout panel, not #editor-status",
  "editor.neo.name_hint": "a line in the Neotone Layout panel, not #editor-status",
};

/* Every refusal code a constructor in src/engine/*.js or index.html can raise. */
const CODES = [
  "BAD_NOTE", "NO_DING", "NO_FIFTH", "NOTE_OUT_OF_ORDER", "NOTE_OUT_OF_RANGE", "NOTE_REPEATED", "NEEDS_NEWER_APP", "PROFILE_CONFLICT", "PROFILE_MAP_INVALID",
  "PROFILE_FULL", "SMALL_LABELS", "SEED_REFUSED", "PARTS", "EMPTY", "DUPLICATE_NOTE", "CONFLICTING_LIST", "TRADE", "TOGGLE_REFUSED",
  "AREA_FULL", "TOO_CROWDED", "NO_ROOM", "FIELD_EMPTY", "OWN_ROW", "FIELDS_FULL", "DING_REQUIRED", "SWITCH_LAYOUT", "PITCH_REPEATED",
];
const RAW_FALLBACK = {
  SEED_REFUSED: "an import-dialog flag, not written to #editor-status",
  PARTS: "an import-dialog info code, not written to #editor-status",
  EMPTY: "an import-dialog code; the editor's empty save uses editor.empty",
  DUPLICATE_NOTE: "an import-dialog code, not written to #editor-status",
  CONFLICTING_LIST: "an import-dialog flag, not written to #editor-status",
  TOGGLE_REFUSED: "editorApplyResult writes res.reason, the text of sheet.toggle_refused (a row, outside DRIFT)",
  TRADE: "editorApplyResult writes res.reason, the same text as sheet.cannot_trade",
  AREA_FULL: "editorApplyResult writes res.reason, the same text as editor.full.*",
  TOO_CROWDED: "editorApplyResult writes res.reason, the same text as editor.crowded",
  NO_ROOM: "editorApplyResult writes res.reason, the same text as editor.say.no_room",
  FIELD_EMPTY: "editorApplyResult writes res.reason, the same text as editor.neo.field_empty",
  OWN_ROW: "editorApplyResult writes res.reason, the same text as editor.neo.own_row",
  FIELDS_FULL: "editorApplyResult writes res.reason, the same text as editor.say.zone_is_full",
  DING_REQUIRED: "The editor uses editor.say.ding_required.",
  SWITCH_LAYOUT: "The editor uses the underlying layout refusal text.",
  PITCH_REPEATED: "The editor uses editor.pitch_repeat for a duplicate pitch.",
};

module.exports = { ROWS, DRIFT, EXCLUDED, CODES, RAW_FALLBACK, LONG_NAME, VALUES };
