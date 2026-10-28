// Self-tests of the e2e test harness itself - tests/helpers/cdp.js and the
// subprocess contracts tests/e2e.test.js's before()/after() hooks rely on
// (a taken port, a SIGTERMed suite, a crashed/slow-starting browser). Moved
// out of tests/e2e.test.js (finding 17, quality refactor 2026-09-30): these
// do not drive a real page the way every e2e journey does, and an 8k-line
// file made them easy to lose track of.
//
// Like tests/e2e.test.js, the browser-driving tests skip with a printed reason if no
// Chromium binary is present (CONTRACT: ./tests/run.sh must work anywhere) -
// several of these tests launch a real (or stand-in) browser subprocess.

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { launch, findBrowser, Browser, ANALYTICS_PATTERNS, takeExceptions } = require("./helpers/cdp.js");

const REPO = path.resolve(__dirname, "..");

const BROWSER = findBrowser();

// Controlled transport for the reviewed foreground-settle contract. Two
// independently named targets model the observable prerequisite: a hidden
// target cannot advance a frame. The fixture answers immediately with a page
// error rather than hanging, so a missing/wrong readiness action is assertion-red.
// Browser's real WebSocket decoding, session routing and evaluation stay in use.
function foregroundTransport({ foreground, visible = false, refuse = false, hold = false, animations = [] } = {}) {
  const listeners = new Map();
  const targets = {
    A: { visible, frames: 0, polls: 0 },
    B: { visible: !visible, frames: 0, polls: 0 },
  };
  const messages = [];
  const pendingActivations = [];
  const denial = { code: -32000, message: "FG fixture activation refused" };
  const response = (message, result, error) => queueMicrotask(() => listeners.get("message")({
    data: JSON.stringify({ id: message.id, ...(error ? { error } : { result }) }),
  }));
  function activate(message, reject = refuse) {
    if (reject) { response(message, null, denial); return; }
    if (targets[message.sessionId]) {
      for (const [name, target] of Object.entries(targets)) target.visible = name === message.sessionId;
    }
    response(message, {});
  }
  const ws = {
    addEventListener(name, callback) { listeners.set(name, callback); },
    close() {},
    send(wire) {
      const message = JSON.parse(wire);
      messages.push(message);
      if (message.method === "Page.bringToFront") {
        if (hold) pendingActivations.push(message);
        else activate(message);
        return;
      }
      if (message.method !== "Runtime.evaluate") { response(message, {}); return; }
      const target = targets[message.sessionId];
      const expression = message.params.expression;
      if (expression.includes("requestAnimationFrame")) {
        if (!target || !target.visible) {
          response(message, { exceptionDetails: { exception: { description: "FG frame refused: target is hidden or absent" } } });
        } else {
          target.frames++;
          response(message, { result: { value: null } });
        }
      } else if (expression.includes("getAnimations")) {
        if (target) target.polls++;
        response(message, { result: { value: animations.length ? animations.shift() : 0 } });
      } else {
        response(message, { result: { value: true } });
      }
    },
  };
  const b = new Browser(null, ws, null);
  // This fixture owns no OS process or directory. close() still exercises the
  // real coverage/WS/lifecycle path, while reap(null) cannot signal any process.
  b.entry = null;
  b.sessionId = "A";
  if (foreground !== undefined) b.foregroundSettle = foreground;
  return {
    b, targets, messages, denial,
    activateCount: () => messages.filter((m) => m.method === "Page.bringToFront").length,
    evalCount: () => messages.filter((m) => m.method === "Runtime.evaluate").length,
    hideA() { targets.A.visible = false; targets.B.visible = true; },
    completeActivation(reject) {
      assert.strictEqual(pendingActivations.length, 1, "one activation must be awaiting its transport response");
      activate(pendingActivations.shift(), reject);
    },
  };
}

// Flush only already queued microtasks; no timing sleeps or real browser work.
async function flushForegroundTransport() {
  for (let i = 0; i < 12; i++) await Promise.resolve();
}

test("FG-1 foregroundSettle advances the correct target after each readiness loss", async () => {
  const f = foregroundTransport({ foreground: true });
  for (let round = 1; round <= 2; round++) {
    f.hideA();
    await assert.doesNotReject(f.b.settle(), "an opted-in hidden target must complete its own frame");
    assert.strictEqual(f.targets.A.frames, round, "the requested target's real frame must advance once");
    assert.deepStrictEqual(f.targets.B, { visible: false, frames: 0, polls: 0 }, "a different target cannot satisfy A's frame");
    assert.strictEqual(f.activateCount(), round, "a later hidden target needs fresh preparation, not a cache");
  }
});

test("FG-2 neutral Browser operations preserve the foreground target", async () => {
  const f = foregroundTransport();
  await f.b.eval("return true;");
  await f.b.send("Runtime.evaluate", { expression: "true", returnByValue: true });
  assert.deepStrictEqual(f.targets.A, { visible: false, frames: 0, polls: 0 });
  assert.deepStrictEqual(f.targets.B, { visible: true, frames: 0, polls: 0 });
  assert.strictEqual(f.activateCount(), 0, "neutral observations must not steal foreground");
  // A neutral settle on an already-visible target preserves its original real
  // frame/animation behavior without adding an activation side effect.
  f.targets.A.visible = true;
  f.targets.B.visible = false;
  await assert.doesNotReject(f.b.settle());
  assert.strictEqual(f.targets.A.frames, 1);
  assert.strictEqual(f.activateCount(), 0, "default settle must remain neutral");
});

test("FG-3 foregroundSettle retains real animation completion", async () => {
  const f = foregroundTransport({ foreground: true, animations: [1, 0] });
  await assert.doesNotReject(f.b.settle());
  assert.strictEqual(f.targets.A.frames, 1, "readiness is not a substitute for the real first frame");
  assert.strictEqual(f.targets.A.polls, 2, "settle must observe the running animation clear, not fabricate completion");
});

test("FG-4 foregroundSettle preserves activation refusal without retry or frame work", async () => {
  const f = foregroundTransport({ foreground: true, refuse: true });
  await assert.rejects(f.b.settle(), { message: JSON.stringify(f.denial) });
  assert.strictEqual(f.activateCount(), 1, "a real activation failure must not be retried");
  assert.strictEqual(f.evalCount(), 0, "failed readiness cannot be followed by a frame or animation poll");
  assert.strictEqual(f.targets.A.frames, 0);
});

test("FG-5 foregroundSettle rejects a missing session before transport work", async () => {
  const f = foregroundTransport({ foreground: true });
  f.b.sessionId = null;
  await assert.rejects(f.b.settle(), /session/i);
  assert.deepStrictEqual(f.messages, [], "missing attached session must not fall back to browser-wide preparation");
});

test("FG-6 foregroundSettle rejects session drift during preparation", async () => {
  const f = foregroundTransport({ foreground: true, hold: true });
  const outcome = f.b.settle().then(() => ({ ok: true }), (error) => ({ error }));
  await flushForegroundTransport();
  assert.strictEqual(f.activateCount(), 1, "the requested target must enter readiness before frames");
  f.b.sessionId = "B";
  f.completeActivation(false);
  const result = await outcome;
  assert.ok(result.error, "settle must reject if its prepared session was replaced");
  assert.match(result.error.message, /session|target/i);
  assert.strictEqual(f.evalCount(), 0, "a different session cannot inherit readiness");
});

test("FG-7 close wins pending readiness before coverage cleanup finishes", async () => {
  const f = foregroundTransport({ foreground: true, hold: true });
  let finishCoverage;
  let coverageStarted = false;
  f.b.coverage = {
    intercept() { return null; },
    finish() { coverageStarted = true; return new Promise((resolve) => { finishCoverage = resolve; }); },
  };
  const outcome = f.b.settle().then(() => ({ ok: true }), (error) => ({ error }));
  await flushForegroundTransport();
  assert.strictEqual(f.activateCount(), 1, "readiness must be in flight for this race");
  const closing = f.b.close();
  try {
    assert.strictEqual(coverageStarted, true, "close must have entered the held cleanup phase");
    f.completeActivation(false);
    const result = await outcome;
    assert.ok(result.error, "successful readiness after close began must reject");
    assert.match(result.error.message, /clos/i);
    assert.strictEqual(f.evalCount(), 0, "close wins before any subsequent frame/animation work");
  } finally {
    finishCoverage();
    await closing;
  }
});

test("FG-8 close preserves an in-flight activation refusal", async () => {
  const f = foregroundTransport({ foreground: true, hold: true });
  const outcome = f.b.settle().then(() => ({ ok: true }), (error) => ({ error }));
  await flushForegroundTransport();
  assert.strictEqual(f.activateCount(), 1, "readiness must be in flight for this race");
  await f.b.close();
  f.completeActivation(true);
  const result = await outcome;
  assert.ok(result.error, "the original activation error must remain a rejection");
  assert.strictEqual(result.error.message, JSON.stringify(f.denial), "close must not replace the real activation cause");
  assert.strictEqual(f.activateCount(), 1);
  assert.strictEqual(f.evalCount(), 0);
});

test("FG-9 settle after close rejects without transport work", async () => {
  const f = foregroundTransport({ foreground: true, visible: true });
  await f.b.close();
  await assert.rejects(f.b.settle(), /clos/i);
  assert.deepStrictEqual(f.messages, []);
});

// Retiring a launch must release its own debug-port pipe as well as its OS
// process. SIGKILL alone cannot guarantee EOF when another descriptor holder
// inherited that pipe. This controlled Node fixture requires no browser.
test("CDP-STDERR retirement closes only the owned launch stream before process exit", async () => {
  const { spawn } = require("node:child_process");
  const os = require("node:os");
  for (const streamState of ["live", "already-destroyed", "absent", "throwing"]) {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), "hpfc-stderr-retirement-"));
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const proc = spawn(process.execPath, ["-e",
      "process.stderr.write('stderr-retirement-ready\\n');setInterval(()=>{},1000);"],
      { detached:true, stdio:["ignore", "ignore", "pipe"], env });
    const stderr = proc.stderr;
    const originalDestroy = stderr.destroy;
    const exited = new Promise(resolve => proc.once("exit", (code, signal) => resolve({code, signal})));
    let wsCloses = 0, destroyThrows = 0;
    const ws = { addEventListener() {}, close() { wsCloses++; } };
    const browser = new Browser(proc, ws, profile, {proc, profileDir:profile});
    async function boundedExit() {
      let timer;
      try {
        return await Promise.race([exited, new Promise((resolve, reject) => {
          timer = setTimeout(() => reject(new Error("owned stderr fixture did not exit within 2s")), 2000);
        })]);
      } finally { clearTimeout(timer); }
    }
    let primaryFailure;
    try {
      await new Promise((resolve, reject) => {
        let text = "";
        const timer = setTimeout(() => { cleanup(); reject(new Error("owned stderr fixture never became ready")); }, 2000);
        const data = chunk => { text += chunk.toString(); if (text.includes("stderr-retirement-ready\n")) { cleanup(); resolve(); } };
        const error = err => { cleanup(); reject(err); };
        const exit = () => { cleanup(); reject(new Error("owned stderr fixture exited before readiness")); };
        const cleanup = () => { clearTimeout(timer); stderr.off("data", data); proc.off("error", error); proc.off("exit", exit); };
        stderr.on("data", data); proc.once("error", error); proc.once("exit", exit);
      });
      assert.strictEqual(stderr.destroyed, false, "the owned launch pipe must be open before retirement");
      if (streamState === "already-destroyed") stderr.destroy();
      if (streamState === "absent") proc.stderr = null;
      if (streamState === "throwing") stderr.destroy = () => {
        // One owned cleanup call throws; later Node stream teardown must regain
        // its real destroy method instead of receiving our failure injection.
        stderr.destroy = originalDestroy;
        destroyThrows++;
        throw new Error("controlled retirement failure");
      };
      await assert.doesNotReject(browser.close(), "owned stream cleanup cannot mask browser retirement");
      // Do not await process exit/close first: close itself must retire its pipe,
      // even when EOF could otherwise remain pending indefinitely.
      if (streamState === "live" || streamState === "already-destroyed") {
        assert.strictEqual(stderr.destroyed, true, "retirement must destroy its owned stderr before awaiting process exit");
      }
      if (streamState === "throwing") assert.strictEqual(destroyThrows, 1, "the guarded retirement call must exercise the cleanup failure");
      assert.strictEqual(wsCloses, 1, "normal websocket retirement remains intact");
      assert.strictEqual(fs.existsSync(profile), false, "owned profile removal still completes");
      const result = await boundedExit();
      assert.strictEqual(result.signal, "SIGKILL", "only the owned fixture must be terminated by retirement");
    } catch (error) {
      primaryFailure = error;
      throw error;
    } finally {
      // Cleanup remains effective on the intended old-helper assertion failure;
      // never sweep profiles/processes or wait for close before releasing a pipe.
      const cleanupFailures = [];
      try {
        try { stderr.destroy = originalDestroy; originalDestroy.call(stderr); }
        catch (error) { cleanupFailures.push(error); }
        if (proc.exitCode === null && proc.signalCode === null) {
          try { process.kill(-proc.pid, "SIGKILL"); } catch { try { proc.kill("SIGKILL"); } catch {} }
        }
        try { await boundedExit(); } catch (error) { cleanupFailures.push(error); }
      } finally {
        // Even a failed exit wait must not strand this fixture's directory.
        try { fs.rmSync(profile, {recursive:true, force:true}); }
        catch (error) { cleanupFailures.push(error); }
      }
      if (cleanupFailures.length) {
        const cleanupFailure = new AggregateError(cleanupFailures, "owned stderr fixture cleanup failed");
        if (primaryFailure) primaryFailure.cause = cleanupFailure;
        else throw cleanupFailure;
      }
    }
  }
});

if (!BROWSER) {
  const why =
    "harness self-tests skipped: no Chromium binary found (set CHROME_BIN to " +
    "enable). This is not a failure - see tests/CONTRACT.md.";
  console.log(why);
  test.skip(why, () => {});
} else {
  run();
}

function run() {
  test("CDP-MOUSE-HELD: Browser.drag retains actual pointer capture until genuine release", async () => {
    const b = await launch({ foregroundSettle: true });
    let pressAttempted = false, released = false, primaryFailure = null;
    let releasePoint = null;
    try {
      // This pure native fixture has no application state or synthetic input.
      const html = `<!doctype html><meta charset="utf-8"><style>
        #card{position:fixed;left:100px;top:100px;width:200px;height:200px;
          background:#aaa;touch-action:none;user-select:none}
        </style><div id="card">Held pointer fixture</div><script>
        const card=document.getElementById('card');
        window.heldFixture={ready:true,id:null,held:false,clicks:0,events:[]};
        const f=window.heldFixture;
        for(const type of ['pointerdown','pointermove','pointerup','pointercancel',
          'gotpointercapture','lostpointercapture','click']){
          document.addEventListener(type,e=>{
            if(f.events.length<32)f.events.push({type:e.type,trusted:e.isTrusted,
              id:e.pointerId,pointerType:e.pointerType,primary:e.isPrimary,
              button:e.button,buttons:e.buttons,x:e.clientX,y:e.clientY,
              onCard:e.target===card,captured:card.hasPointerCapture(e.pointerId)});
          },true);
        }
        card.addEventListener('pointerdown',e=>{
          f.id=e.pointerId;f.held=true;card.setPointerCapture(e.pointerId);
        });
        card.addEventListener('pointerup',()=>{f.held=false;});
        card.addEventListener('pointercancel',()=>{f.held=false;});
        card.addEventListener('click',()=>{f.clicks++;});
        <\/script>`;
      await b.send("Page.navigate", { url: "data:text/html," + encodeURIComponent(html) });
      await b.waitFor("window.heldFixture && heldFixture.ready === true", {
        timeout: 2000, label: "pure held-pointer fixture readiness",
      });
      await b.settle();
      const point = await b.eval(`
        const card=document.getElementById('card'),r=card.getBoundingClientRect();
        const x=r.left+r.width/2,y=r.top+r.height/2;
        return {x,y,visible:document.visibilityState==='visible',connected:card.isConnected,
          hit:document.elementFromPoint(x,y)===card,
          usable:r.width>0&&r.height>0&&x>=0&&y>=0&&x<innerWidth&&y<innerHeight};
      `);
      assert.ok(point.visible && point.connected && point.hit && point.usable,
        "the real native fixture target must be visible, connected and hit-testable");
      releasePoint = { x: point.x + 24, y: point.y };
      pressAttempted = true;
      await b.drag("#card", [[24, 20]], { pointer: "mouse", release: false });
      const held = await b.eval(`
        const f=window.heldFixture,card=document.getElementById('card');
        return {id:f.id,held:f.held,clicks:f.clicks,events:f.events.slice(),
          connected:card.isConnected,captured:f.id!==null&&card.hasPointerCapture(f.id)};
      `);
      console.log("CDP_MOUSE_HELD_SNAPSHOT " + JSON.stringify(held));
      const down = held.events.find(e => e.type === "pointerdown");
      const move = held.events.find(e => e.type === "pointermove");
      assert.ok(down && down.trusted && down.primary && down.onCard && down.pointerType === "mouse" && down.buttons === 1,
        "the fixture must receive an actual trusted primary mouse press on its card");
      assert.ok(move && move.trusted && move.primary && move.onCard && move.pointerType === "mouse" && move.buttons === 1,
        "the helper must deliver an actual trusted primary buttons-one mouse move to the same card");
      assert.strictEqual(move.id, down.id, "the held move uses the actual pressed pointer");
      assert.strictEqual(held.id, down.id);
      assert.ok(Math.abs(move.x - down.x - 24) <= 1 && Math.abs(move.y - down.y) <= 1,
        "the genuine held pointer must move24px horizontally without vertical drift");
      assert.strictEqual(held.connected, true);
      assert.strictEqual(held.held, true, "no real release has occurred before the capture oracle");
      // Intended RED: validate actual input first, then inspect native capture.
      assert.strictEqual(held.captured, true,
        "Browser.drag release:false must retain actual pointer capture after its held mouse move");
      const gotIndex = held.events.findIndex(e => e.type === "gotpointercapture" && e.id === down.id && e.trusted && e.onCard);
      const moveIndex = held.events.indexOf(move);
      assert.ok(gotIndex >= 0 && gotIndex < moveIndex,
        "native capture must be acquired for this actual pointer before the held move");
      assert.deepStrictEqual(held.events.filter(e => ["pointerup", "pointercancel", "lostpointercapture"].includes(e.type)), [],
        "no release, cancellation or capture loss may compete with the held gesture");
      assert.strictEqual(held.clicks, 0);
      await b.releasing(() => b.send("Input.dispatchMouseEvent", {
        type: "mouseReleased", ...releasePoint, button: "left", clickCount: 1,
      }));
      released = true;
      await b.waitForPendingSettle();
      const ended = await b.eval(`
        const f=window.heldFixture,card=document.getElementById('card');
        return {held:f.held,captured:card.hasPointerCapture(f.id),clicks:f.clicks,
          lpcSeen:window.__cdpLpcSeen,events:f.events.slice()};
      `);
      console.log("CDP_MOUSE_RELEASED_SNAPSHOT " + JSON.stringify(ended));
      assert.ok(ended.events.some(e => e.type === "pointerup" && e.trusted && e.id === down.id && e.pointerType === "mouse" && e.onCard),
        "the same actual mouse pointer must receive its genuine release");
      assert.ok(ended.events.some(e => e.type === "lostpointercapture" && e.trusted && e.id === down.id && e.onCard),
        "the actual captured pointer must genuinely lose capture after release");
      assert.strictEqual(ended.lpcSeen, true, "the helper's own real-release observer must see capture loss");
      assert.strictEqual(ended.held, false);
      assert.strictEqual(ended.captured, false);
      const clicks = ended.events.filter(e => e.type === "click");
      assert.strictEqual(ended.clicks, 1, "one genuine release must produce exactly one fixture click");
      assert.strictEqual(clicks.length, 1);
      assert.ok(clicks[0].trusted && clicks[0].onCard, "the release click must be genuine and target this card");
    } catch (error) {
      primaryFailure = error;
      throw error;
    } finally {
      const cleanupFailures = [];
      if (pressAttempted && !released && releasePoint) {
        try {
          await b.releasing(() => b.send("Input.dispatchMouseEvent", {
            type: "mouseReleased", ...releasePoint, button: "left", clickCount: 1,
          }));
        } catch (error) { cleanupFailures.push(error); }
      }
      try { await b.waitForPendingSettle(); } catch (error) { cleanupFailures.push(error); }
      try { await b.close(); } catch (error) { cleanupFailures.push(error); }
      if (cleanupFailures.length) {
        const failure = new AggregateError(cleanupFailures, "owned held-pointer fixture cleanup failed");
        if (primaryFailure) primaryFailure.cause = failure;
        else throw failure;
      }
    }
  });

  test("FG-10 opted-in native settle advances only its target after repeated hiding", async () => {
    const neutral = await launch();
    try {
      assert.strictEqual(neutral.foregroundSettle, false,
        "omitting the launch option must preserve a neutral instance policy");
    } finally {
      await neutral.close();
    }
    const b = await launch({ foregroundSettle: true });
    const firstSession = b.sessionId;
    const page = (name) => "data:text/html," + encodeURIComponent(
      `<body><div id="ready">${name}</div><script>window.targetName=${JSON.stringify(name)};window.frameCount=0;</script>`);
    // This single Browser/connection switches only between its own two attached
    // sessions, serially. No unrelated target or signed-in profile is inspected.
    const inSession = async (session, action) => {
      const previous = b.sessionId;
      b.sessionId = session;
      try { return await action(); }
      finally { b.sessionId = previous; }
    };
    const state = (session) => inSession(session, () => b.eval(
      "return {name:window.targetName,visible:document.visibilityState,frames:window.frameCount};"));
    try {
      // The instance policy is an explicit contract input, independently of
      // native scheduling. Dropped launch forwarding must fail promptly here;
      // the target/frame assertions below still prove the policy's real effect.
      assert.strictEqual(b.foregroundSettle, true,
        "launch must preserve the requested foreground-settle instance policy");
      await b.send("Page.navigate", { url: page("A") });
      await b.waitFor("window.targetName === 'A'", { label: "foreground fixture A" });
      const { targetId } = await b.send("Target.createTarget", { url: page("B") }, false);
      const { sessionId: secondSession } = await b.send("Target.attachToTarget", { targetId, flatten: true }, false);
      await inSession(secondSession, async () => {
        await b.send("Page.enable");
        await b.send("Runtime.enable");
        await b.waitFor("window.targetName === 'B'", { label: "foreground fixture B" });
      });
      for (let round = 1; round <= 2; round++) {
        await inSession(secondSession, () => b.send("Page.bringToFront"));
        await inSession(secondSession, () => b.waitFor("document.visibilityState === 'visible'", {
          timeout: 2000, label: "fixture B is actually foreground",
        }));
        await b.waitFor("document.visibilityState === 'hidden'", {
          timeout: 2000, label: "fixture A is actually background",
        });
        const beforeA = await state(firstSession);
        const beforeB = await state(secondSession);
        assert.deepStrictEqual(beforeA, { name: "A", visible: "hidden", frames: round - 1 },
          "native setup must establish a genuinely hidden A, not mock visibility");
        assert.deepStrictEqual(beforeB, { name: "B", visible: "visible", frames: 0 });
        await b.eval("return window.targetName;");
        assert.deepStrictEqual(await state(firstSession), beforeA,
          "neutral evaluation must not activate hidden A");
        assert.deepStrictEqual(await state(secondSession), beforeB,
          "neutral observation of A must leave B foreground");
        // Enqueue without awaiting a background frame. Completion is observed
        // only after the helper has prepared A and waited for its real frame.
        await b.eval("requestAnimationFrame(() => { window.frameCount++; }); return true;");
        await assert.doesNotReject(b.settle(), "opted-in settle must advance A's real frame");
        await b.waitFor(`window.frameCount === ${round}`, { timeout: 2000, label: "A-owned frame marker" });
        assert.deepStrictEqual(await state(firstSession), { name: "A", visible: "visible", frames: round });
        assert.deepStrictEqual(await state(secondSession), { name: "B", visible: "hidden", frames: 0 },
          "preparing A must not advance or replace B's independent sentinel");
      }
    } finally {
      b.sessionId = firstSession;
      await b.close();
    }
  });

  /* ------------------------------------------------------------------ *
   * settle() - finding 6, quality refactor 2026-09-30. Unit-level: a fake
   * Browser whose eval() is stubbed to report controlled getAnimations()
   * counts, so these do not need a live page or a real animation and cannot
   * flake on CI timing the way driving a real CSS transition would.
   * ------------------------------------------------------------------ */

  test("settle() returns promptly when no animation is running", async () => {
    let calls = 0;
    const b = Object.create(Browser.prototype);
    b.eval = async () => {
      calls++;
      // Call 1 is the single rAF wait settle() always pays up front; every
      // call after that is a getAnimations().length poll.
      return calls === 1 ? null : 0;
    };
    const t0 = Date.now();
    await b.settle();
    const elapsed = Date.now() - t0;
    assert.ok(elapsed < 200, `settle() took ${elapsed}ms with no animation ever running`);
    assert.strictEqual(calls, 2,
      `settle() should check getAnimations() once and return, not loop (saw ${calls} eval calls)`);
  });

  test("settle() waits for a running animation to finish", async () => {
    let calls = 0;
    const b = Object.create(Browser.prototype);
    b.eval = async () => {
      calls++;
      // Call 1: the rAF wait. Calls 2-3: still animating. Call 4+: cleared.
      if (calls === 1) return null;
      if (calls <= 3) return 1;
      return 0;
    };
    await b.settle();
    assert.ok(calls >= 4,
      `settle() must keep polling until getAnimations() clears, not return on the first ` +
      `nonzero read (saw only ${calls} eval calls)`);
  });

  test("settle() gives up at its 500ms ceiling rather than hanging on a stuck animation", async () => {
    const b = Object.create(Browser.prototype);
    let calls = 0;
    b.eval = async () => { calls++; return calls === 1 ? null : 1; }; // never clears
    b.strictSettle = false;
    const t0 = Date.now();
    await b.settle();
    const elapsed = Date.now() - t0;
    assert.ok(elapsed >= 480 && elapsed < 1500,
      `settle() should bail out around its 500ms ceiling, not sooner or much later (took ${elapsed}ms)`);
  });

  /* ---------------------------------------------------------------- *
   * harness contract: a taken port fails loudly, it does not hang
   * ---------------------------------------------------------------- */

  // Regression guard. Several agents share this machine and the port is fixed,
  // so a collision is routine; before this test the `listen` await never
  // settled on EADDRINUSE (the callback only fires on success), so the run hung
  // until something outside killed it and waitForServer's "is port N taken?"
  // message was dead code in exactly the case it was written for.
  //
  // The child is marked with E2E_HARNESS_CHILD so it cannot re-enter here.
  test("a taken port fails the harness fast, naming the port and E2E_PORT", async () => {
    if (process.env.E2E_HARNESS_CHILD) return;

    const net = require("node:net");
    const { spawnSync } = require("node:child_process");

    // Port 0: the OS picks a free one, so this can never collide with a
    // parallel agent the way a hardcoded number would.
    const squatter = net.createServer();
    await new Promise((res, rej) => {
      squatter.once("error", rej);
      squatter.listen(0, "127.0.0.1", res);
    });
    const taken = squatter.address().port;

    // This file is itself running inside node's test runner, which marks the
    // environment with NODE_TEST_CONTEXT. Inherited, that makes the child think
    // it is a runner-managed worker and exit 0 immediately - which would make
    // this test pass against a broken harness. Strip it.
    const env = { ...process.env, E2E_PORT: String(taken), E2E_HARNESS_CHILD: "1" };
    delete env.NODE_TEST_CONTEXT;

    let r;
    try {
      r = spawnSync(process.execPath, ["--test", "tests/e2e.test.js"], {
        cwd: REPO,
        encoding: "utf8",
        timeout: 30000,
        env,
      });
    } finally {
      await new Promise((res) => squatter.close(res));
    }

    const out = (r.stdout || "") + (r.stderr || "");
    // A timeout kill shows up as a signal (and, on some platforms, an error).
    // That IS the hang, so it must fail here rather than pass quietly.
    assert.strictEqual(r.signal, null,
      `the harness was killed by ${r.signal} - it hung on a taken port instead of failing`);
    assert.strictEqual(r.error, undefined,
      `spawnSync failed: ${r.error && r.error.message}`);
    assert.strictEqual(typeof r.status, "number", "no exit status from the harness");
    assert.notStrictEqual(r.status, 0, "the harness exited 0 with its port taken");
    assert.ok(out.includes(String(taken)),
      `the failure never named port ${taken}:\n${out.slice(-2000)}`);
    assert.ok(out.includes("E2E_PORT"),
      `the failure never mentioned E2E_PORT:\n${out.slice(-2000)}`);
  });

  // The other half of the same defect: `node --test` has no per-test deadline,
  // so a wedged suite used to hang tests/suite_health.py forever - which is how
  // a single stuck port burned a whole CI job. run_node_file must bound every
  // suite it starts and report the overrun as a PROBLEM, not a traceback.
  test("suite_health bounds every node suite with a wall clock", async () => {
    if (process.env.E2E_HARNESS_CHILD) return;

    const os = require("node:os");
    const { spawnSync } = require("node:child_process");

    // A suite that never finishes. Written outside tests/ so the *.test.js glob
    // in suite_health.py cannot pick it up and demand a FLOORS row for it.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "suite-health-hang-"));
    const hang = path.join(dir, "hang.test.js");
    fs.writeFileSync(hang,
      'require("node:test").test("never finishes", () => ' +
      "new Promise((r) => setTimeout(r, 60000)));\n");

    const probe = [
      "import sys",
      "from tests import suite_health",
      "total, failed, skipped, cancelled, returncode, out = suite_health.run_node_file(sys.argv[1])",
      'print("TOTAL", total)',
      "print(out)",
    ].join("\n");

    // Same NODE_TEST_CONTEXT trap as above: inherited, the node run_node_file
    // starts would think it is a runner-managed worker and exit at once.
    const env = { ...process.env, NODE_SUITE_TIMEOUT: "3" };
    delete env.NODE_TEST_CONTEXT;

    const started = Date.now();
    let r;
    try {
      r = spawnSync("python3", ["-c", probe, hang], {
        cwd: REPO,
        encoding: "utf8",
        timeout: 60000,
        env,
      });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    const elapsed = Date.now() - started;
    const out = (r.stdout || "") + (r.stderr || "");

    assert.strictEqual(r.signal, null,
      `run_node_file was killed by ${r.signal} - it never bounded the hung suite`);
    assert.strictEqual(r.error, undefined,
      `run_node_file never returned: ${r.error && r.error.message} (after ${elapsed}ms)`);
    assert.strictEqual(r.status, 0,
      `run_node_file raised instead of reporting the timeout:\n${out.slice(-2000)}`);
    assert.ok(!/Traceback \(most recent call last\)/.test(out),
      `the timeout surfaced as a traceback:\n${out.slice(-2000)}`);
    assert.ok(/^TOTAL None$/m.test(out),
      `a timed-out suite must not report a test count:\n${out.slice(-2000)}`);
    assert.ok(out.includes("TIMED OUT after 3s"),
      `the timeout was not reported with its limit:\n${out.slice(-2000)}`);
    assert.ok(out.includes("hang.test.js"),
      `the timeout report did not name the file:\n${out.slice(-2000)}`);
  });


  /* ---------------------------------------------------------------- *
   * browser reaping (tests/helpers/cdp.js)
   *
   * The harness spawns a real browser and a real profile directory. Both are
   * cleaned up by close(), which only ever runs from after(). Two paths skip
   * after() entirely and used to orphan the browser: a launch() that rejects
   * AFTER spawn (the debug-port timeout, the WebSocket open, any of the setup
   * CDP sends), and a suite killed by a signal - which is exactly how
   * SUITE_TIMEOUT in tests/mutation_check.sh and NODE_TIMEOUT in
   * tests/suite_health.py end an overrunning run. The orphans were observed on
   * a dev box as chrome-headless-shell roots reparented to init, alongside 52
   * abandoned hpfc-prof-* directories.
   *
   * Both tests give the child its own TMPDIR, so "was the profile directory
   * removed?" is answerable without guessing which hpfc-prof-* was ours, and
   * so a stray process can be recognised by its --user-data-dir argument.
   * Every child strips NODE_TEST_CONTEXT: inherited, a node child believes it
   * is a runner-managed worker and exits 0 at once, which would make these
   * pass against the very code they exist to condemn.
   * ---------------------------------------------------------------- */

  const { spawn: spawnChild, execFileSync } = require("node:child_process");
  const osmod = require("node:os");

  function childEnv(extra) {
    const env = { ...process.env, E2E_HARNESS_CHILD: "1", ...extra };
    delete env.NODE_TEST_CONTEXT;
    return env;
  }

  function alive(pid) {
    try { process.kill(pid, 0); return true; } catch { return false; }
  }

  // Anything still running that was pointed at this profile root - the browser
  // root process and every renderer/zygote child carry --user-data-dir.
  function processesUnder(dir) {
    let out = "";
    try { out = execFileSync("ps", ["-eo", "pid=,args=", "-ww"], { encoding: "utf8" }); } catch { return []; }
    return out.split("\n").filter((l) => l.includes(dir));
  }

  function killUnder(dir) {
    for (const line of processesUnder(dir)) {
      const pid = Number(line.trim().split(/\s+/)[0]);
      if (pid && pid !== process.pid) { try { process.kill(pid, "SIGKILL"); } catch {} }
    }
  }

  async function until(pred, ms) {
    const deadline = Date.now() + ms;
    for (;;) {
      if (pred()) return true;
      if (Date.now() > deadline) return false;
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  const CDP_HELPER = path.join(REPO, "tests/helpers/cdp.js");

  test("a SIGTERMed suite reaps its browser and its profile directory", async () => {
    if (process.env.E2E_HARNESS_CHILD) return;

    const tmp = fs.mkdtempSync(path.join(osmod.tmpdir(), "reap-term-"));
    // Launch a browser, announce the root pid, then sit still: no after(), no
    // close() - only a signal handler can save this.
    const script =
      "const { launch } = require(" + JSON.stringify(CDP_HELPER) + ");" +
      "(async () => { const b = await launch();" +
      "  if (!b) { console.log('NOBROWSER'); process.exit(0); }" +
      "  console.log('PID ' + b.proc.pid + ' DIR ' + b.profileDir);" +
      "  setInterval(() => {}, 1000); })();";

    const child = spawnChild(process.execPath, ["-e", script], {
      cwd: REPO, env: childEnv({ TMPDIR: tmp }), stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "", err = "";
    child.stdout.on("data", (d) => { out += d.toString(); });
    child.stderr.on("data", (d) => { err += d.toString(); });
    const exited = new Promise((r) => child.on("exit", (c, s) => r({ c, s })));

    const announced = await until(() => /PID \d+ DIR \S+/.test(out) || /NOBROWSER/.test(out), 60000);
    if (/NOBROWSER/.test(out)) {
      child.kill("SIGKILL"); await exited;
      fs.rmSync(tmp, { recursive: true, force: true });
      return;
    }
    assert.ok(announced, `the child never launched a browser:\n${out}\n${err.slice(-2000)}`);
    const m = out.match(/PID (\d+) DIR (\S+)/);
    const browserPid = Number(m[1]);
    const profileDir = m[2];
    assert.ok(alive(browserPid), "the browser was not running before the kill");

    try {
      child.kill("SIGTERM");
      // A handler that swallows the signal would be a WORSE bug than the leak:
      // an overrunning suite would stop being killable. The child must die.
      // The race has an explicit settle point, so the loser's timer is cleared
      // rather than left armed: an armed timer holds node's event loop open for
      // its full budget, and this suite runs 34 more times in every sweep.
      let bail;
      const gone = await Promise.race([
        exited,
        new Promise((r) => { bail = setTimeout(() => r(null), 15000); }),
      ]).finally(() => clearTimeout(bail));
      assert.ok(gone, "SIGTERM did not terminate the child - the handler swallowed it");

      const reaped = await until(() => !alive(browserPid), 10000);
      assert.ok(reaped, `browser pid ${browserPid} outlived the SIGTERMed suite`);
      const clear = await until(() => processesUnder(profileDir).length === 0, 10000);
      assert.ok(clear, `processes still hold the profile:\n${processesUnder(profileDir).join("\n")}`);
      const removed = await until(() => !fs.existsSync(profileDir), 10000);
      assert.ok(removed, `the profile directory survived: ${profileDir}`);
    } finally {
      try { child.kill("SIGKILL"); } catch {}
      killUnder(tmp);
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test("a launch() that fails after spawn leaves no browser and no profile", async () => {
    if (process.env.E2E_HARNESS_CHILD) return;

    const tmp = fs.mkdtempSync(path.join(osmod.tmpdir(), "reap-fail-"));
    // A stand-in browser that reports a debug port nothing is listening on, so
    // launch() gets past spawn and then fails at the WebSocket - the shape of
    // every post-spawn failure, without a 20s wait for the port timeout.
    const fake = path.join(tmp, "fake-browser");
    fs.writeFileSync(fake,
      "#!/bin/sh\n" +
      "echo 'DevTools listening on ws://127.0.0.1:1/devtools/browser/dead' 1>&2\n" +
      "exec sleep 300\n");
    fs.chmodSync(fake, 0o755);

    const profiles = path.join(tmp, "profiles");
    fs.mkdirSync(profiles);
    // The child reports what is left the moment launch() rejects, BEFORE it
    // exits. Checking after exit would prove nothing: the process-teardown
    // reaper cleans up on the way out, so a launch() that never reaped its own
    // failure would still look clean from outside. The leak this closes is the
    // window a long-lived process spends holding an orphan it already gave up on.
    const script =
      "const { execFileSync } = require('node:child_process');" +
      "const fs = require('node:fs');" +
      "const { launch } = require(" + JSON.stringify(CDP_HELPER) + ");" +
      "(async () => { try { await launch(); console.log('NOTHROW'); }" +
      "  catch (e) { console.log('THREW ' + (e && (e.message || e.type || e))); }" +
      "  const root = process.env.TMPDIR;" +
      "  const left = fs.readdirSync(root).filter((n) => n.startsWith('hpfc-prof-'));" +
      "  const ps = execFileSync('ps', ['-eo', 'pid=,args=', '-ww'], { encoding: 'utf8' })" +
      "    .split('\\n').filter((l) => l.includes(root));" +
      "  console.log('LEFT ' + JSON.stringify(left));" +
      "  console.log('PROCS ' + ps.length);" +
      "  process.exit(0); })();";

    const r = await new Promise((resolve) => {
      const c = spawnChild(process.execPath, ["-e", script], {
        cwd: REPO,
        env: childEnv({ TMPDIR: profiles, CHROME_BIN: fake }),
        stdio: ["ignore", "pipe", "pipe"],
      });
      let o = "", e = "";
      c.stdout.on("data", (d) => { o += d.toString(); });
      c.stderr.on("data", (d) => { e += d.toString(); });
      c.on("exit", (code) => resolve({ code, o, e }));
      // unref: a pure backstop must not by itself keep the process alive for a
      // minute after the child has already exited.
      setTimeout(() => { try { c.kill("SIGKILL"); } catch {} }, 60000).unref();
    });

    try {
      assert.ok(/THREW/.test(r.o),
        `launch() should have rejected past spawn:\n${r.o}\n${r.e.slice(-2000)}`);
      // The original error is a diagnostic other lanes read; it must survive.
      assert.ok(!/THREW (undefined|null)\b/.test(r.o), `the failure lost its error:\n${r.o}`);

      const leftLine = r.o.match(/LEFT (\[.*\])/);
      assert.ok(leftLine, `the child never reported its profile directories:\n${r.o}`);
      assert.deepStrictEqual(JSON.parse(leftLine[1]), [],
        `launch() left profile directories behind: ${leftLine[1]}`);
      const procLine = r.o.match(/PROCS (\d+)/);
      assert.ok(procLine, `the child never reported surviving processes:\n${r.o}`);
      assert.strictEqual(Number(procLine[1]), 0,
        `launch() left ${procLine[1]} process(es) holding the profile`);
      // And nothing outlived the child either.
      const clear = await until(() => processesUnder(profiles).length === 0, 5000);
      assert.ok(clear,
        `a browser outlived the failed launch:\n${processesUnder(profiles).join("\n")}`);
    } finally {
      killUnder(tmp);
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });


  /* ---------------------------------------------------------------- *
   * launch retry (tests/helpers/cdp.js)
   *
   * CI run 34518203026 aborted the mutation gate at its BASELINE check: the
   * e2e suite failed on the CLEAN tree with "browser did not report a debug
   * port", ~2 minutes into a 232-mutant sweep, and attempt 2 with no code
   * change was green. The exit branch of the launch race did NOT fire, so the
   * browser was alive and had simply not printed its DevTools ws URL inside
   * the 20s bound - a loaded runner, not breakage. Fourth occurrence, first
   * captured signature.
   *
   * So launch() retries that ONE rejection ONCE. The two tests below are the
   * whole contract: a slow start is retried (and its first, still-alive
   * browser reaped first), and a browser that really fails is NOT - retrying
   * real breakage only doubles the wall clock before the same failure.
   *
   * Both drive a stand-in browser through CHROME_BIN, the seam findBrowser()
   * already has, and both lower the port bound through
   * HPFC_CDP_PORT_TIMEOUT_MS - which can only ever LOWER it - so the slow-start
   * path costs the sweep half a second instead of 20 seconds twice.
   * ---------------------------------------------------------------- */

  // Reports, from inside the child and BEFORE it exits (see the reaping tests
  // above for why "after exit" would prove nothing): how many times the fake
  // browser was executed, what launch() finally threw, and what it left behind.
  const LAUNCH_PROBE =
    "const { execFileSync } = require('node:child_process');" +
    "const fs = require('node:fs');" +
    "const { launch } = require(" + JSON.stringify(CDP_HELPER) + ");" +
    "(async () => { try { await launch(); console.log('NOTHROW'); }" +
    "  catch (e) { console.log('THREW ' + (e && (e.message || e.type || e))); }" +
    "  const log = process.env.FAKE_LOG;" +
    "  console.log('LAUNCHES ' + (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\\n').filter(Boolean).length : 0));" +
    "  const root = process.env.TMPDIR;" +
    "  const left = fs.readdirSync(root).filter((n) => n.startsWith('hpfc-prof-'));" +
    "  const ps = execFileSync('ps', ['-eo', 'pid=,args=', '-ww'], { encoding: 'utf8' })" +
    "    .split('\\n').filter((l) => l.includes(root));" +
    "  console.log('LEFT ' + JSON.stringify(left));" +
    "  console.log('PROCS ' + ps.length);" +
    "  process.exit(0); })();";

  function runLaunchProbe(fakeBody, tmp) {
    const fake = path.join(tmp, "fake-browser");
    const log = path.join(tmp, "invocations");
    fs.writeFileSync(fake, fakeBody.replace(/@LOG@/g, log));
    fs.chmodSync(fake, 0o755);
    const profiles = path.join(tmp, "profiles");
    fs.mkdirSync(profiles);
    return new Promise((resolve) => {
      const c = spawnChild(process.execPath, ["-e", LAUNCH_PROBE], {
        cwd: REPO,
        env: childEnv({
          TMPDIR: profiles, CHROME_BIN: fake, FAKE_LOG: log,
          HPFC_CDP_PORT_TIMEOUT_MS: "500",
        }),
        stdio: ["ignore", "pipe", "pipe"],
      });
      let o = "", e = "";
      c.stdout.on("data", (d) => { o += d.toString(); });
      c.stderr.on("data", (d) => { e += d.toString(); });
      c.on("exit", (code) => resolve({ code, o, e }));
      setTimeout(() => { try { c.kill("SIGKILL"); } catch {} }, 60000).unref();
    });
  }

  test("a slow-starting browser is retried once, and the first one is reaped", async () => {
    if (process.env.E2E_HARNESS_CHILD) return;

    const tmp = fs.mkdtempSync(path.join(osmod.tmpdir(), "launch-slow-"));
    // First run: alive, silent, past the bound - the observed CI signature
    // exactly (NOT an exit, which is a different branch and must not retry).
    // Second run: reports a port nothing listens on, so the retry is provably
    // reached without this test needing a real browser.
    const body =
      "#!/bin/sh\n" +
      "echo run >> '@LOG@'\n" +
      "if [ \"$(wc -l < '@LOG@')\" -le 1 ]; then exec sleep 120; fi\n" +
      "echo 'DevTools listening on ws://127.0.0.1:1/devtools/browser/dead' 1>&2\n" +
      "exec sleep 120\n";
    const r = await runLaunchProbe(body, tmp);

    try {
      const launches = r.o.match(/LAUNCHES (\d+)/);
      assert.ok(launches, `the child never reported the launch count:\n${r.o}\n${r.e.slice(-2000)}`);
      assert.strictEqual(Number(launches[1]), 2,
        "a slow start must be retried exactly once (two browsers spawned, not " +
        `${launches[1]}):\n${r.o}\n${r.e.slice(-2000)}`);
      // Not the timeout again: the retry got past the port wait and died at the
      // dead WebSocket, which is only reachable on the second attempt.
      assert.ok(!/THREW browser did not report a debug port/.test(r.o),
        `the retry never happened - launch() rethrew the slow-start timeout:\n${r.o}`);
      // A silent retry turns a known intermittent into an unknown slowdown.
      assert.ok(/retry/i.test(r.e),
        `the retry was silent - nothing on stderr names it:\n${r.e.slice(-2000)}`);
      // The first browser is ALIVE when the retry starts; not reaping it leaks a
      // Chrome and a profile dir per retry.
      const leftLine = r.o.match(/LEFT (\[.*\])/);
      assert.ok(leftLine, `the child never reported its profile directories:\n${r.o}`);
      assert.deepStrictEqual(JSON.parse(leftLine[1]), [],
        `the retry left profile directories behind: ${leftLine[1]}`);
      const procLine = r.o.match(/PROCS (\d+)/);
      assert.ok(procLine, `the child never reported surviving processes:\n${r.o}`);
      assert.strictEqual(Number(procLine[1]), 0,
        `the retry left ${procLine[1]} process(es) holding a profile`);
    } finally {
      killUnder(tmp);
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test("a browser that exits at once is not retried", async () => {
    if (process.env.E2E_HARNESS_CHILD) return;

    const tmp = fs.mkdtempSync(path.join(osmod.tmpdir(), "launch-dead-"));
    // Real breakage, not a slow runner: retrying it just pays the same failure
    // twice, and on a 232-mutant sweep that is the difference between a red
    // suite and a timed-out one.
    const body =
      "#!/bin/sh\n" +
      "echo run >> '@LOG@'\n" +
      "exit 3\n";
    const r = await runLaunchProbe(body, tmp);

    try {
      const launches = r.o.match(/LAUNCHES (\d+)/);
      assert.ok(launches, `the child never reported the launch count:\n${r.o}\n${r.e.slice(-2000)}`);
      assert.strictEqual(Number(launches[1]), 1,
        "a browser that exited must NOT be retried (one spawn, not " +
        `${launches[1]}):\n${r.o}\n${r.e.slice(-2000)}`);
      assert.ok(/THREW browser exited: 3/.test(r.o),
        `the original failure must reach the caller unchanged:\n${r.o}`);
    } finally {
      killUnder(tmp);
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
  /* ------------------------------------------------------------------ *
   * EX-1 / EX-3 (complexity refactor 2026-10-03, lane EX): an exception the
   * app throws on its own must reach the test that caused it, and a settle()
   * that gave up at its ceiling must say so.
   * ------------------------------------------------------------------ */

  const THROWER =
    "data:text/html," + encodeURIComponent(
      "<button id=b onclick=\"throw new Error('EX1-click')\">x</button>" +
      "<button id=d onclick=\"setTimeout(()=>{throw new Error('EX1-delayed')},30)\">y</button>");

  async function loadThrower(br) {
    await br.send("Page.navigate", { url: THROWER });
    await br.waitFor("document.getElementById('b')", { label: "thrower page" });
  }

  test("EX-1 an uncaught handler exception is reported", async () => {
    takeExceptions();
    const a = await launch();
    const c = await launch();
    try {
      await loadThrower(a);
      await loadThrower(c);
      await a.eval("document.getElementById('b').click();");
      await c.eval("document.getElementById('d').click();");
      const deadline = Date.now() + 5000;
      let seen = [];
      while (Date.now() < deadline) {
        seen = seen.concat(takeExceptions());
        if (seen.some((t) => /EX1-click/.test(t)) && seen.some((t) => /EX1-delayed/.test(t))) break;
        await new Promise((r) => setTimeout(r, 40));
      }
      assert.ok(seen.some((t) => /EX1-click/.test(t)), `first instance's throw missing: ${JSON.stringify(seen)}`);
      assert.ok(seen.some((t) => /EX1-delayed/.test(t)), `second instance's setTimeout throw missing: ${JSON.stringify(seen)}`);
    } finally {
      await a.close();
      await c.close();
    }
  });

  test("EX-3 settle reports a ceiling hit", async () => {
    const b = await launch();
    const lines = [];
    const orig = process.stderr.write;
    b.strictSettle = false;
    try {
      await b.send("Page.navigate", { url: "data:text/html," + encodeURIComponent(
        "<div id=a style='width:10px;height:10px;background:red'></div>" +
        "<script>document.getElementById('a').animate([{opacity:0},{opacity:1}],{duration:1e9})</script>") });
      await b.waitFor("document.getElementById('a')", { label: "animated page" });
      process.stderr.write = function (chunk, ...rest) { lines.push(String(chunk)); return true; };
      await b.settle();
    } finally {
      process.stderr.write = orig;
      await b.close();
    }
    assert.ok(lines.some((l) => /E2E-SETTLE-CEILING/.test(l)),
      `settle() hit its 500ms ceiling silently; stderr was ${JSON.stringify(lines)}`);
  });

  test("HX-3 settle rejects at its ceiling unless strictSettle is off", async () => {
    const b = Object.create(Browser.prototype);
    let calls = 0;
    b.eval = async () => { calls++; return calls === 1 ? null : 1; };
    await assert.rejects(b.settle(), /E2E-SETTLE-CEILING/);
  });

  test("HX-4 waitFor names the last evaluation error when it times out", async () => {
    const b = Object.create(Browser.prototype);
    b.eval = async () => { throw new Error("boom"); };
    await assert.rejects(b.waitFor("x", { timeout: 60, label: "L" }), /timed out waiting for L.*last error: .*boom/);
  });
}

/* ------------------------------------------------------------------ *
 * tools/sandbox.js gaps the discoverability work needs (plan section 9, W2).
 * ------------------------------------------------------------------ */

const sandbox = require("../tools/sandbox.js");
const INDEX_HTML = () => fs.readFileSync(sandbox.APP, "utf8");

test("boot skips a script whose type is not JavaScript", () => {
  const html = INDEX_HTML().replace("</head>", `<script type="application/ld+json">{"a":1}</script></head>`);
  assert.doesNotThrow(() => sandbox.boot({ html }));
});

test("the sandbox reports navigator.webdriver true unless told otherwise", () => {
  assert.strictEqual(sandbox.boot({}).get("navigator.webdriver"), true);
  assert.strictEqual(sandbox.boot({ webdriver: false }).get("navigator.webdriver"), false);
});

test("the sandbox document has a head that records appended children", () => {
  const app = sandbox.boot({});
  const head = app.sandbox.document.head;
  assert.ok(head, "document.head exists");
  const el = app.sandbox.document.createElement("script");
  head.appendChild(el);
  assert.strictEqual(app.head.children.length, 1);
  assert.strictEqual(app.head.children[0], el);
});

test("the sandbox location exposes protocol and hostname", () => {
  const f = sandbox.boot({ href: "file:///x/index.html" }).location;
  assert.deepStrictEqual([f.protocol, f.hostname], ["file:", ""]);
  const h = sandbox.boot({ href: "http://localhost:8000/" }).location;
  assert.deepStrictEqual([h.protocol, h.hostname], ["http:", "localhost"]);
});

test("the sandbox can dispatch hashchange to window listeners", () => {
  const html = INDEX_HTML().replace("</body>", `<script>window.__hc = []; window.addEventListener("hashchange", () => window.__hc.push(location.hash));</script></body>`);
  const app = sandbox.boot({ html });
  app.hashchange("#x");
  assert.deepStrictEqual(JSON.parse(app.get("JSON.stringify(window.__hc)")), ["#x"]);
});

test("boot takes an html string in place of the file", () => {
  assert.throws(() => sandbox.boot({ html: "<html></html>" }), /no inline <script>/);
  const html = INDEX_HTML().replace("</body>", "<script>window.__marker = 42;</script></body>");
  assert.strictEqual(sandbox.boot({ html }).get("window.__marker"), 42);
});

test("stub elements have select()", () => {
  const app = sandbox.boot({});
  assert.strictEqual(typeof app.els["share-url"].select, "function");
  assert.doesNotThrow(() => app.els["share-url"].select());
  assert.ok(app.els["share-copy"]);
});

test("boot reads type as an attribute and runs every JavaScript MIME type", () => {
  const ran = (tag) => {
    const html = INDEX_HTML().replace("</body>", `${tag}</body>`);
    return sandbox.boot({ html }).get("window.__ran");
  };
  assert.strictEqual(ran(`<script data-type="x">window.__ran = 1;</script>`), 1, "data-type is not type");
  assert.strictEqual(ran(`<script type="application/javascript">window.__ran = 2;</script>`), 2);
  assert.strictEqual(ran(`<script type="text/ecmascript">window.__ran = 3;</script>`), 3);
  assert.strictEqual(ran(`<script type="application/ld+json">window.__ran = 4;</script>`), undefined);
});

test("boot names the html option when it has no JavaScript block", () => {
  assert.throws(() => sandbox.boot({ html: `<script type="application/ld+json">{}</script>` }), /the html option/);
});

test("the sandbox hashchange fires only on a real change and carries oldURL and newURL", () => {
  const html = INDEX_HTML().replace("</body>", `<script>window.__hc = []; window.addEventListener("hashchange", (e) => window.__hc.push([e.oldURL, e.newURL]));</script></body>`);
  const app = sandbox.boot({ html });
  app.hashchange("#a");
  const seen = () => JSON.parse(app.get("JSON.stringify(window.__hc)"));
  const before = seen().length;
  app.hashchange("#a");
  assert.strictEqual(seen().length, before, "the same hash fires nothing");
  app.hashchange("#a", { force: true });
  assert.strictEqual(seen().length, before + 1, "force fires the listeners on the same hash");
  const forced = seen().length;
  app.hashchange("#b");
  assert.deepStrictEqual(seen().slice(forced), [["https://example.test/index.html#a", "https://example.test/index.html#b"]]);
});

test("Browser.off removes the one handler on() kept for a method", () => {
  const b = Object.create(Browser.prototype);
  b.eventHandlers = new Map();
  b.on("X.y", () => {});
  assert.ok(b.eventHandlers.has("X.y"));
  b.off("X.y");
  assert.strictEqual(b.eventHandlers.has("X.y"), false);
});

test("enableRealFonts sends the same block list it reports as blockedUrls", async () => {
  const b = Object.create(Browser.prototype);
  b.eventHandlers = new Map();
  const sent = [];
  b.send = async (method, params) => { sent.push([method, params]); };
  await b.enableRealFonts();
  const fetchEnable = sent.find(([m]) => m === "Fetch.enable");
  assert.deepStrictEqual(fetchEnable[1].patterns.map((p) => p.urlPattern), b.blockedUrls);
  assert.ok(b.blockedUrls.some((u) => /googletagmanager/.test(u)) && b.blockedUrls.some((u) => /google-analytics/.test(u)));
});

test("the Fetch.requestPaused handler fails a request to every ANALYTICS_PATTERNS host", async () => {
  const b = Object.create(Browser.prototype);
  b.eventHandlers = new Map();
  const sent = [];
  b.send = async (method, params) => { sent.push([method, params]); };
  await b.enableRealFonts();
  const analytics = b.blockedUrls.filter((u) => /googletagmanager|google-analytics/.test(u));
  assert.strictEqual(analytics.length, 2);
  const handler = b.eventHandlers.get("Fetch.requestPaused");
  for (const pattern of analytics) {
    sent.length = 0;
    const url = "https://" + pattern.replace(/\*/g, "") + "/g/collect?v=2";
    await handler({ requestId: "r1", request: { url } });
    assert.deepStrictEqual(sent, [["Fetch.failRequest", { requestId: "r1", errorReason: "BlockedByClient" }]], pattern);
  }
  sent.length = 0;
  await handler({ requestId: "r2", request: { url: "https://fonts.googleapis.com/css2?family=Marcellus" } });
  assert.deepStrictEqual(sent.map(([m]) => m), ["Fetch.fulfillRequest"], "a font request is served, not failed");
  sent.length = 0;
  await handler({ requestId: "r3", request: { url: "https://example.test/index.html" } });
  assert.deepStrictEqual(sent.map(([m]) => m), ["Fetch.continueRequest"], "any other request continues");
});

test("every ANALYTICS_PATTERNS entry is a *literal* glob, the only shape matchesAnalytics reads", async () => {
  assert.ok(ANALYTICS_PATTERNS.length >= 2);
  const b = Object.create(Browser.prototype);
  b.eventHandlers = new Map();
  const sent = [];
  b.send = async (method, params) => { sent.push([method, params]); };
  await b.enableRealFonts();
  const handler = b.eventHandlers.get("Fetch.requestPaused");
  for (const p of ANALYTICS_PATTERNS) {
    assert.match(p, /^\*[^*?\[\]]+\*$/, p);
    const core = p.replace(/\*/g, "");
    sent.length = 0;
    await handler({ requestId: "lit", request: { url: "https://" + core + "/x" } });
    assert.deepStrictEqual(sent.map(([m]) => m), ["Fetch.failRequest"], "the literal host is blocked: " + p);
    sent.length = 0;
    await handler({ requestId: "dot", request: { url: "https://" + core.replace(".", "X") + "/x" } });
    assert.deepStrictEqual(sent.map(([m]) => m), ["Fetch.continueRequest"], "a dot is a dot, not a wildcard: " + p);
  }
});

test("the sandbox reports navigator.languages ['en-US','en'] unless told otherwise", () => {
  const dflt = sandbox.boot({});
  assert.deepStrictEqual(Array.from(dflt.get("navigator.languages")), ["en-US", "en"]);
  assert.strictEqual(dflt.get("navigator.language"), "en-US");
  const de = sandbox.boot({ languages: ["de-CH", "fr"] });
  assert.deepStrictEqual(Array.from(de.get("navigator.languages")), ["de-CH", "fr"]);
  assert.strictEqual(de.get("navigator.language"), "de-CH");
});

// Literal synthetic scripts exercise the helper, not the application that will
// consume it. These tests are unit-only; the SVH selector never launches Chrome.
const svhHTML = '<script>window.marker = "synchronous";</script>';
const svhTurn = () => new Promise(resolve => setImmediate(resolve));
const svhGate = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a;reject=b; }); return {promise,resolve,reject}; };

test("SVH1 shared raw storage crosses opted-in realms and isolates other origins", () => {
  const origin = {};
  const a = sandbox.boot({html:svhHTML,origin,storage:{sample:'  raw seed  '}});
  const b = sandbox.boot({html:svhHTML,origin});
  a.run('localStorage.setItem("sample", "  changed raw  ")');
  assert.strictEqual(b.get('localStorage.getItem("sample")'), '  changed raw  ', 'an acknowledged raw write must be visible to the other opted-in realm');
  const c = sandbox.boot({html:svhHTML,origin,href:'https://another.test/'});
  assert.strictEqual(c.get('localStorage.getItem("sample")'),null);
  assert.strictEqual(sandbox.boot({html:svhHTML}).get('localStorage.getItem("sample")'),null);
});

test("SVH2 exclusive requests are asynchronous FIFO and hold through callback settlement", async () => {
  const origin=sandbox.createOrigin();
  const a=sandbox.boot({html:svhHTML,origin,locks:true}), b=sandbox.boot({html:svhHTML,origin,locks:true});
  const other=sandbox.boot({html:svhHTML,origin,locks:true,href:'https://another.test/'});
  const gate=svhGate(), order=[];
  const first=a.sandbox.navigator.locks.request('collection',{mode:'exclusive'},lock=>{order.push('A');assert.strictEqual(lock.mode,'exclusive');return gate.promise;});
  const second=b.sandbox.navigator.locks.request('collection',()=>{order.push('B');return 'second';});
  const third=a.sandbox.navigator.locks.request('collection',()=>{order.push('C');return 'third';});
  assert.deepStrictEqual(order,[],'callbacks cannot acquire inline');
  await svhTurn();assert.deepStrictEqual(order,['A'],'a pending callback promise still owns the lock');
  assert.strictEqual(await other.sandbox.navigator.locks.request('collection',()=> 'other origin'),'other origin');
  const queued=await b.sandbox.navigator.locks.query();
  assert.deepStrictEqual(queued.held.map(x=>x.name),['collection']);
  assert.deepStrictEqual(queued.pending.map(x=>x.name),['collection','collection']);
  assert.notStrictEqual(queued.held[0].clientId,queued.pending[0].clientId);
  gate.resolve('first');
  assert.deepStrictEqual(await Promise.all([first,second,third]),['first','second','third']);
  assert.deepStrictEqual(order,['A','B','C']);
  assert.deepStrictEqual(await a.sandbox.navigator.locks.query(),{held:[],pending:[]});
});

test("SVH3 rejected lock callbacks release ownership and retain their exact error", async () => {
  const origin=sandbox.createOrigin(), app=sandbox.boot({html:svhHTML,origin,locks:true});
  const failure=new Error('callback rejected');
  const first=app.sandbox.navigator.locks.request('one',()=>Promise.reject(failure));
  const caught=assert.rejects(first,error=>error===failure);
  const second=app.sandbox.navigator.locks.request('one',()=>17);
  await caught;assert.strictEqual(await second,17);
  const syncFailure=new Error('synchronous callback throw');
  await assert.rejects(app.sandbox.navigator.locks.request('one',()=>{throw syncFailure;}),error=>error===syncFailure);
  assert.strictEqual(await app.sandbox.navigator.locks.request('one',()=>23),23);
});

test("SVH4 pending abort rejects without entering while abort after grant cannot undo a commit", async () => {
  const origin=sandbox.createOrigin(), app=sandbox.boot({html:svhHTML,origin,locks:true,abortController:true});
  const hold=svhGate(), held=app.sandbox.navigator.locks.request('one',()=>hold.promise);
  await svhTurn();
  const controller=new app.sandbox.AbortController();let entered=false;
  const queued=app.sandbox.navigator.locks.request('one',{signal:controller.signal},()=>{entered=true;});
  const rejected=assert.rejects(queued,error=>error.name==='AbortError');controller.abort();await rejected;
  hold.resolve();await held;assert.strictEqual(entered,false);
  const granted=new app.sandbox.AbortController(), completion=svhGate();let commits=0;
  const active=app.sandbox.navigator.locks.request('one',{signal:granted.signal},()=>{commits++;granted.abort();return completion.promise;});
  await svhTurn();assert.strictEqual(commits,1);completion.resolve('ack');assert.strictEqual(await active,'ack');
  const preAborted=new app.sandbox.AbortController();preAborted.abort(new Error('owner canceled'));
  await assert.rejects(app.sandbox.navigator.locks.request('one',{signal:preAborted.signal},()=>{entered=true;}),/owner canceled/);
  assert.strictEqual(entered,false);
});

test("SVH5 storage events carry recipient area and writer URL only to other same-origin realms", () => {
  const origin=sandbox.createOrigin({events:'manual'});
  const a=sandbox.boot({html:svhHTML,origin,href:'https://example.test/a#writer'});
  const b=sandbox.boot({html:svhHTML,origin,href:'https://example.test/b'});
  const c=sandbox.boot({html:svhHTML,origin,href:'https://other.test/c'});
  const own=[],received=[],foreign=[];
  a.sandbox.addEventListener('storage',e=>own.push(e));
  b.sandbox.addEventListener('storage',e=>received.push(e));
  c.sandbox.addEventListener('storage',e=>foreign.push(e));
  a.run('localStorage.setItem("pan", "first");localStorage.setItem("pan", "first");localStorage.setItem("pan", "second");localStorage.removeItem("absent");');
  assert.strictEqual(received.length,0,'manual events remain delayed');
  origin.flushStorageEvents();
  assert.deepStrictEqual(received.map(e=>({key:e.key,oldValue:e.oldValue,newValue:e.newValue,url:e.url})),[
    {key:'pan',oldValue:null,newValue:'first',url:'https://example.test/a#writer'},
    {key:'pan',oldValue:'first',newValue:'second',url:'https://example.test/a#writer'}]);
  assert.ok(received.every(e=>e.storageArea===b.sandbox.localStorage));
  assert.deepStrictEqual(own,[]);assert.deepStrictEqual(foreign,[]);
  const removed=()=>{throw new Error('removed listener ran');};b.sandbox.addEventListener('storage',removed);
  a.run('localStorage.removeItem("pan")');b.sandbox.removeEventListener('storage',removed);origin.flushStorageEvents();
  assert.strictEqual(received.at(-1).newValue,null);
});

test("SVH6 automatic and deliberately omitted storage events leave raw shared reads authoritative", async () => {
  for(const mode of ['auto','omit']) {
    const origin=sandbox.createOrigin({events:mode});
    const a=sandbox.boot({html:svhHTML,origin}),b=sandbox.boot({html:svhHTML,origin});
    const events=[];b.sandbox.addEventListener('storage',e=>events.push(e));
    a.run('localStorage.setItem("latest", "yes")');
    assert.strictEqual(events.length,0,'events are never delivered inline');
    assert.strictEqual(b.get('localStorage.getItem("latest")'),'yes');
    await new Promise(resolve=>setTimeout(resolve,10));
    assert.strictEqual(events.length,mode==='auto'?1:0);
  }
});

test("SVH7 failed storage acknowledgments are separate from successful writes and preserve raw data", () => {
  const origin=sandbox.createOrigin({storage:{pan:'original'},events:'manual'});
  const quota=Object.assign(new Error('quota'),{name:'QuotaExceededError'});
  const app=sandbox.boot({html:svhHTML,origin,storageFault:op=>op.operation==='setItem'&&op.value==='refused'?quota:null});
  assert.throws(()=>app.run('localStorage.setItem("pan", "refused")'),error=>error===quota);
  assert.strictEqual(app.get('localStorage.getItem("pan")'),'original');
  app.run('localStorage.setItem("pan", "acknowledged")');
  assert.deepStrictEqual(origin.writeAttempts.map(x=>[x.operation,x.key,x.value,x.success]),[
    ['setItem','pan','refused',false],['setItem','pan','acknowledged',true]]);
  assert.deepStrictEqual(origin.successfulWrites.map(x=>[x.key,x.value]),[['pan','acknowledged']]);
  const denied=Object.assign(new Error('access denied'),{name:'SecurityError'});
  const inaccessible=sandbox.boot({html:svhHTML,origin,storageAccessError:denied});
  assert.throws(()=>inaccessible.get('localStorage'),error=>error===denied);
  assert.strictEqual(app.get('localStorage.getItem("pan")'),'acknowledged');
});

test("SVH8 capabilities are explicit and support missing throwing and deterministic collision cases", async () => {
  const missing=sandbox.boot({html:svhHTML});
  assert.strictEqual(missing.get('typeof crypto'),'undefined');
  assert.strictEqual(missing.get('typeof navigator.locks'),'undefined');
  assert.strictEqual(missing.get('typeof AbortController'),'undefined');
  const repeated='00000000-0000-4000-8000-000000000001';
  const sequence=[repeated,repeated,'00000000-0000-4000-8000-000000000002'];
  const app=sandbox.boot({html:svhHTML,crypto:{randomUUID:()=>sequence.shift(),getRandomValues:bytes=>{bytes.fill(7);return bytes;}},isSecureContext:true,abortController:true});
  assert.deepStrictEqual([app.get('crypto.randomUUID()'),app.get('crypto.randomUUID()'),app.get('crypto.randomUUID()')],[repeated,repeated,'00000000-0000-4000-8000-000000000002']);
  assert.deepStrictEqual(sandbox.plain(app.get('Array.from(crypto.getRandomValues(new Uint8Array(3)))')),[7,7,7]);
  assert.strictEqual(app.get('isSecureContext'),true);
  const failure=new Error('guarded access denied');
  for(const [option,expression] of [['locksAccessError','navigator.locks'],['cryptoAccessError','crypto']]) {
    const bad=sandbox.boot({html:svhHTML,[option]:failure});assert.throws(()=>bad.get(expression),error=>error===failure);
  }
  const refused=sandbox.boot({html:svhHTML,locks:true,locksRequestError:failure});
  let called=false;await assert.rejects(refused.sandbox.navigator.locks.request('x',()=>{called=true;}),error=>error===failure);
  assert.strictEqual(called,false);
});

test("SVH9 async evaluation and generation normalize only their settled values", async () => {
  const app=sandbox.boot({html:'<script>function generateDeck(text,options){return Promise.resolve({ok:true,text,options});}</script>'});
  assert.deepStrictEqual(await app.getAsync('Promise.resolve({nested:["settled"]})'),{nested:['settled']});
  assert.deepStrictEqual(await app.generateAsync('public',{palette:2}),{ok:true,text:'public',options:{palette:2}});
  await assert.rejects(app.getAsync('Promise.reject(new Error("actual async failure"))'),/actual async failure/);
});

test("SVH10 async clicks dispatch every listener before waiting for actual completion without draining timers", async () => {
  const app=sandbox.boot({html:`<script>
    window.order=[];window.complete=false;window.timerFired=false;
    setTimeout(()=>window.timerFired=true,5000);
    document.getElementById('next').addEventListener('click',()=>new Promise(resolve=>{window.release=()=>{order.push('ack');complete=true;resolve();};order.push('first');}));
    document.getElementById('next').addEventListener('click',()=>order.push('second'));
  </script>`});
  const pending=app.clickAsync(app.els.next,{until:'window.complete'});
  assert.deepStrictEqual(sandbox.plain(app.get('order')),['first','second'],'listeners dispatch synchronously before the first handler settles');
  assert.strictEqual(app.get('timerFired'),false);app.run('release()');await pending;
  assert.deepStrictEqual(sandbox.plain(app.get('order')),['first','second','ack']);assert.strictEqual(app.get('timerFired'),false);
});

test("SVH11 explicit readiness rejects errors and bounded incomplete state instead of treating microtasks as ready", async () => {
  const app=sandbox.boot({html:svhHTML});
  await assert.rejects(app.waitFor('false',{timeout:20}),/readiness.*timed out/i);
  await assert.rejects(app.waitFor('(()=>{throw new Error("readiness fault")})()'),/readiness fault/);
  await assert.rejects(app.waitFor('new Promise(()=>{})',{timeout:20}),/readiness.*timed out/i);
  await assert.rejects(app.waitFor('(()=>{while(true){}})()',{timeout:20}),/timed out/i);
  await assert.rejects(app.clickAsync(app.els.next),/until/);
  assert.strictEqual(await app.waitFor('Promise.resolve(true)'),true);
});

test("SVH12 default boot stays synchronous with isolated storage and no durable capability injection", () => {
  const seed={literal:'original'};
  const app=sandbox.boot({html:svhHTML,storage:seed});
  assert.strictEqual(app.get('marker'),'synchronous');assert.strictEqual(typeof app.then,'undefined');
  app.run('localStorage.setItem("literal", "changed")');assert.deepStrictEqual(seed,{literal:'original'});
  assert.strictEqual(sandbox.boot({html:svhHTML,storage:seed}).get('localStorage.getItem("literal")'),'original');
  assert.strictEqual(app.get('typeof navigator.locks'),'undefined');assert.strictEqual(app.get('typeof crypto'),'undefined');
});

test("SVH13 compound descendant queries require every class and live ancestry", () => {
  const app=sandbox.boot({html:svhHTML});
  app.run(`
    var root=document.getElementById("decks"), other=document.getElementById("card");
    var outside=document.createElement("button");outside.id="outside";outside.className="chip on";other.appendChild(outside);
    var partial=document.createElement("button");partial.id="partial";partial.className="chip";root.appendChild(partial);
    var wrapper=document.createElement("section");root.appendChild(wrapper);
    var target=document.createElement("button");target.id="target";target.className="chip on";wrapper.appendChild(target);
  `);
  assert.strictEqual(app.get('document.querySelector("#decks .chip.on") === target'),true,"compound descendant lookup must find the actual nested active chip");
  assert.strictEqual(app.get('document.querySelector("#decks button.on.chip") === target'),true,"tag and reversed class tokens keep their meanings");
  assert.deepStrictEqual(sandbox.plain(app.get('Array.from(document.querySelectorAll("#decks .chip.on"),n=>n.id)')),["target"],"wrong ancestor and missing class are excluded");
  assert.strictEqual(app.get('document.querySelector("#scale-sheet .chip.on")'),null);
  assert.strictEqual(app.get('document.querySelector("#decks .chip.off")'),null);
  app.run('wrapper.removeChild(target)');
  assert.strictEqual(app.get('document.querySelector("#decks .chip.on")'),null,"detached old active chip cannot receive focus");
  app.run('var replacement=document.createElement("button");replacement.id="replacement";replacement.className="chip on";wrapper.appendChild(replacement)');
  assert.strictEqual(app.get('document.querySelector("#decks .chip.on") === replacement'),true,"rebuilt strip resolves its current connected node");
  assert.strictEqual(app.get('document.querySelector("#decks") === root'),true);
  assert.strictEqual(app.get('document.querySelector("section") === wrapper'),true);
  assert.deepStrictEqual(sandbox.plain(app.get('Array.from(document.querySelectorAll("#decks, #card"),n=>n.id).sort()')),["card","decks"],"simple and comma selectors retain their existing results");
});

// The opt-in model uses the native API shape. These are model semantics, not
// evidence of a real browser's IndexedDB or BroadcastChannel implementation.
const idbhOpen = (app, name = 'model', version = 1, upgrade = db => db.createObjectStore('collections')) => new Promise((resolve, reject) => {
  const request = app.sandbox.indexedDB.open(name, version);
  request.onupgradeneeded = () => upgrade(request.result, request.transaction);
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
const idbhDone = tx => new Promise((resolve, reject) => {
  tx.addEventListener('complete', resolve); tx.addEventListener('abort', () => reject(tx.error || new Error('aborted')));
});
const idbhResult = req => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
});
const idbhBoot = options => sandbox.boot({ html: svhHTML, indexedDB: true, ...options });

test('IDBH1 explicit capability asynchronous upgrade and committed raw value presence', async () => {
  const plain = sandbox.boot({ html: svhHTML });
  assert.strictEqual(plain.get('typeof indexedDB'), 'undefined');
  assert.strictEqual(plain.get('typeof BroadcastChannel'), 'undefined');
  const app = idbhBoot(); let sync = true;
  const open = idbhOpen(app).then(db => { assert.strictEqual(sync, false); return db; });
  sync = false; const db = await open;
  assert.strictEqual(db.version, 1); assert.strictEqual(db.objectStoreNames.contains('collections'), true);
  const tx = db.transaction('collections', 'readwrite'), done = idbhDone(tx), store = tx.objectStore('collections');
  assert.strictEqual(store.keyPath, null); assert.strictEqual(store.autoIncrement, false);
  store.put(undefined, 'present'); store.put({ opaque: new Uint8Array([3, 8]) }, 'raw'); await done;
  const raw = app.idb.inspect('model');
  assert.strictEqual(raw.stores[0].entries.some(([key]) => key === 'present'), true);
  assert.strictEqual(raw.stores[0].entries.find(([key]) => key === 'present')[1], undefined);
  raw.stores[0].entries.find(([key]) => key === 'raw')[1].opaque[0] = 99;
  assert.strictEqual(app.idb.inspect('model').stores[0].entries.find(([key]) => key === 'raw')[1].opaque[0], 3);
  const read = db.transaction('collections'), completed = idbhDone(read), s = read.objectStore('collections');
  const present = idbhResult(s.getKey('present')), missing = idbhResult(s.getKey('absent'));
  assert.strictEqual(await present, 'present'); assert.strictEqual(await missing, undefined); await completed;
});

test('IDBH2 overlapping transactions see predecessor commit at grant and preserve both writes', async () => {
  const origin = sandbox.createOrigin(), a = idbhBoot({ origin }), b = idbhBoot({ origin });
  const dbA = await idbhOpen(a), dbB = await idbhOpen(b);
  a.idb.hold('commit');
  const first = dbA.transaction('collections', 'readwrite'), firstDone = idbhDone(first);
  const put = idbhResult(first.objectStore('collections').put('A', 'first'));
  await put;
  const second = dbB.transaction('collections', 'readwrite'), secondDone = idbhDone(second);
  const observed = idbhResult(second.objectStore('collections').get('first'));
  second.objectStore('collections').put('B', 'second');
  assert.deepStrictEqual(a.idb.inspect('model').stores[0].entries, []);
  a.idb.release('commit'); await firstDone;
  assert.strictEqual(await observed, 'A', 'later overlapping transaction must read preceding committed write');
  await secondDone;
  assert.deepStrictEqual(a.idb.inspect('model').stores[0].entries, [['first', 'A'], ['second', 'B']]);
});

test('IDBH3 successful put is not commit and post-put abort rolls back', async () => {
  const app = idbhBoot(), db = await idbhOpen(app);
  app.idb.fault('abortAfterPut', new Error('rollback after request success'));
  const tx = db.transaction('collections', 'readwrite'), done = idbhDone(tx);
  const result = await idbhResult(tx.objectStore('collections').put('candidate', 'current'));
  assert.strictEqual(result, 'current');
  await assert.rejects(done, /rollback after request success/);
  assert.deepStrictEqual(app.idb.inspect('model').stores[0].entries, []);
  const good = db.transaction('collections', 'readwrite'), committed = idbhDone(good);
  good.objectStore('collections').put('safe', 'current'); await committed;
  assert.throws(() => good.abort(), { name: 'InvalidStateError' });
  assert.deepStrictEqual(app.idb.inspect('model').stores[0].entries, [['current', 'safe']]);
});

test('IDBH4 aborted first-open probe leaves no committed schema and open errors remain distinct', async () => {
  const app = idbhBoot();
  await assert.rejects(idbhOpen(app, 'probe', undefined, (db, tx) => tx.abort()), /AbortError/);
  assert.strictEqual(app.idb.inspect('probe'), undefined);
  app.idb.fault('open', new Error('denied open'));
  await assert.rejects(idbhOpen(app, 'probe'), /denied open/);
  assert.strictEqual(app.idb.inspect('probe'), undefined);
  const db = await idbhOpen(app, 'probe'); db.close();
  await assert.rejects(idbhOpen(app, 'probe', 0), /invalid database version/);
});

test('IDBH5 versionchange blocks upgrade until close and closed connection refuses new transactions', async () => {
  const origin = sandbox.createOrigin(), a = idbhBoot({ origin }), b = idbhBoot({ origin });
  const db = await idbhOpen(a); const events = [];
  db.onversionchange = event => events.push(['versionchange', event.newVersion]);
  const request = b.sandbox.indexedDB.open('model', 2);
  const completed = new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
  request.onblocked = () => { events.push(['blocked']); db.close(); };
  request.onupgradeneeded = () => events.push(['upgrade']);
  const upgraded = await completed;
  assert.deepStrictEqual(events, [['versionchange', 2], ['blocked'], ['upgrade']]);
  assert.strictEqual(upgraded.version, 2);
  assert.throws(() => db.transaction('collections'), { name: 'InvalidStateError' });
  await assert.rejects(idbhOpen(a, 'model', 1), { name: 'VersionError' });
});

test('IDBH6 read put and commit faults abort without changing committed data', async () => {
  const app = idbhBoot(), db = await idbhOpen(app);
  for (const operation of ['read', 'put', 'commit']) {
    app.idb.fault(operation, new Error(operation + ' denied'));
    const tx = db.transaction('collections', 'readwrite'), done = idbhDone(tx);
    if (operation === 'read') { const read = tx.objectStore('collections').get('current'); read.onerror = () => {}; }
    else { const put = tx.objectStore('collections').put('bad', 'current'); put.onerror = () => {}; }
    await assert.rejects(done, new RegExp(operation + ' denied'));
    assert.deepStrictEqual(app.idb.inspect('model').stores[0].entries, []);
  }
});

test('IDBH7 held late open and read settlement are explicit host controls', async () => {
  const app = idbhBoot(); app.idb.hold('open');
  let opened = false; const pending = idbhOpen(app).then(db => { opened = true; return db; });
  await svhTurn(); assert.strictEqual(opened, false); assert.strictEqual(app.idb.pending('open'), 1);
  app.idb.release('open'); const db = await pending;
  app.idb.hold('read'); const tx = db.transaction('collections'), done = idbhDone(tx);
  const result = idbhResult(tx.objectStore('collections').get('current'));
  await svhTurn(); await svhTurn(); assert.strictEqual(app.idb.pending('read'), 1);
  app.idb.release('read'); assert.strictEqual(await result, undefined); await done;
});

test('IDBH8 BroadcastChannel hints are asynchronous other-channel partitioned cloned and optional', async () => {
  const origin = sandbox.createOrigin({ broadcastEvents: 'manual' });
  const a = idbhBoot({ origin, broadcastChannel: true }), b = idbhBoot({ origin, broadcastChannel: true });
  const x = idbhBoot({ origin, broadcastChannel: true, href: 'https://elsewhere.test/' });
  const ca = new a.sandbox.BroadcastChannel('updates'), cb = new b.sandbox.BroadcastChannel('updates');
  const wrongName = new b.sandbox.BroadcastChannel('other'), wrongOrigin = new x.sandbox.BroadcastChannel('updates');
  const messages = []; ca.onmessage = () => messages.push('self'); cb.onmessage = event => messages.push(event.data);
  wrongName.onmessage = () => messages.push('name'); wrongOrigin.onmessage = () => messages.push('origin');
  const hint = { revision: 7 }; ca.postMessage(hint); hint.revision = 99;
  assert.deepStrictEqual(messages, []); origin.flushBroadcastMessages();
  assert.deepStrictEqual(messages, [{ revision: 7 }]);
  ca.postMessage({ revision: 8 }); origin.flushBroadcastMessages({ omit: true }); assert.strictEqual(messages.length, 1);
  ca.postMessage({ revision: 9 }); cb.close(); origin.flushBroadcastMessages(); assert.strictEqual(messages.length, 1);
  assert.strictEqual(a.idb.inspect('model'), undefined, 'notification alone cannot create authority');
});

test('IDBH9 concurrent first opens share one committed database and aborting a probe does not strand later open', async () => {
  const origin = sandbox.createOrigin(), a = idbhBoot({ origin }), b = idbhBoot({ origin });
  let upgrades = 0;
  const create = db => { upgrades++; db.createObjectStore('collections'); };
  const [dbA, dbB] = await Promise.all([idbhOpen(a, 'race', 1, create), idbhOpen(b, 'race', 1, create)]);
  assert.strictEqual(upgrades, 1, 'one first-open upgrade owns schema creation');
  const tx = dbA.transaction('collections', 'readwrite'), done = idbhDone(tx);
  tx.objectStore('collections').put('A', 'current'); await done;
  const read = dbB.transaction('collections'), readDone = idbhDone(read);
  assert.strictEqual(await idbhResult(read.objectStore('collections').get('current')), 'A'); await readDone;
  const probe = idbhOpen(a, 'probed', undefined, (db, upgrade) => upgrade.abort());
  const retry = idbhOpen(b, 'probed'); await assert.rejects(probe, /AbortError/); await retry;
});

test('IDBH10 close waits for active transaction and upgrade cannot bypass its commit', async () => {
  const origin = sandbox.createOrigin(), a = idbhBoot({ origin }), b = idbhBoot({ origin });
  const db = await idbhOpen(a); a.idb.hold('commit');
  const tx = db.transaction('collections', 'readwrite'), done = idbhDone(tx);
  await idbhResult(tx.objectStore('collections').put('kept', 'current')); db.close();
  let upgraded = false;
  const future = idbhOpen(b, 'model', 2, () => { upgraded = true; });
  await svhTurn(); await svhTurn(); assert.strictEqual(upgraded, false);
  a.idb.release('commit'); await done; const next = await future;
  const read = next.transaction('collections'), readDone = idbhDone(read);
  assert.strictEqual(await idbhResult(read.objectStore('collections').get('current')), 'kept'); await readDone;
});

test('IDBH11 completed read can resolve late while peer commits without changing captured result', async () => {
  const origin = sandbox.createOrigin(), a = idbhBoot({ origin }), b = idbhBoot({ origin });
  const dbA = await idbhOpen(a), dbB = await idbhOpen(b);
  a.idb.hold('complete');
  const read = dbA.transaction('collections'), readDone = idbhDone(read);
  assert.strictEqual(await idbhResult(read.objectStore('collections').get('current')), undefined);
  const write = dbB.transaction('collections', 'readwrite'), writeDone = idbhDone(write);
  write.objectStore('collections').put('new', 'current'); await writeDone;
  assert.deepStrictEqual(a.idb.inspect('model').stores[0].entries, [['current', 'new']]);
  assert.strictEqual(a.idb.pending('complete'), 1); a.idb.release('complete'); await readDone;
});

test('IDBH12 schema metadata and autoincrement round trip without crossing origin partitions', async () => {
  const origin = sandbox.createOrigin(), a = idbhBoot({ origin });
  const db = await idbhOpen(a, 'schema', 3, db => db.createObjectStore('collections', { keyPath: 'id', autoIncrement: true }));
  const tx = db.transaction('collections', 'readwrite'), done = idbhDone(tx), store = tx.objectStore('collections');
  assert.strictEqual(store.keyPath, 'id'); assert.strictEqual(store.autoIncrement, true);
  const first = idbhResult(store.put({ text: 'one' })), second = idbhResult(store.put({ id: 7, text: 'seven' }));
  assert.strictEqual(await first, 1); assert.strictEqual(await second, 7); await done;
  const other = idbhBoot({ origin, href: 'https://other.test/' });
  assert.strictEqual(other.idb.inspect('schema'), undefined);
  assert.strictEqual(a.idb.inspect('schema').version, 3);
});

test('IDBH13 abort settles queued requests as errors and request handlers can append atomic writes', async () => {
  const app = idbhBoot(), db = await idbhOpen(app);
  const aborted = db.transaction('collections', 'readwrite'), done = idbhDone(aborted);
  const pending = idbhResult(aborted.objectStore('collections').get('missing'));
  aborted.abort(); await assert.rejects(pending, { name: 'AbortError' }); await assert.rejects(done, /aborted/);
  const tx = db.transaction('collections', 'readwrite'), committed = idbhDone(tx), store = tx.objectStore('collections');
  const read = store.get('current');
  read.onsuccess = () => store.put('handler-write', 'current');
  await committed;
  assert.deepStrictEqual(app.idb.inspect('model').stores[0].entries, [['current', 'handler-write']]);
});

test('IDBH14 host operation evidence distinguishes readonly probing from durable write attempts', async () => {
  const origin = sandbox.createOrigin(), writer = idbhBoot({ origin });
  const db = await idbhOpen(writer); db.close();
  const reader = idbhBoot({ origin }), readDB = await idbhOpen(reader);
  const tx = readDB.transaction('collections'), done = idbhDone(tx);
  tx.objectStore('collections').get('current'); await done; readDB.close();
  assert.strictEqual(reader.idb.operations.some(event => ['put', 'upgrade', 'createObjectStore'].includes(event.operation)), false);
  assert.strictEqual(reader.idb.operations.some(event => event.operation === 'transaction' && event.mode !== 'readonly'), false);
  const evidence = reader.idb.operations; evidence.push({ operation: 'put' });
  assert.strictEqual(reader.idb.operations.some(event => event.operation === 'put'), false, 'inspection cannot mutate model evidence');
  assert.strictEqual(writer.idb.operations.some(event => event.operation === 'createObjectStore'), true);
});
