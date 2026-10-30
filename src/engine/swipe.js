/* HPE.swipe - the pure core of the card swipe: thresholds, decisions, momentum.
 * Plain script, inlined verbatim; `var` so it lands on a node:vm global. */
var HPE = (typeof HPE !== "undefined") ? HPE : {};
HPE.swipe = (function () {
  "use strict";
  const SWIPE_COMMIT_PX = 18, SWIPE_FLING_PX_MS = 0.15, SWIPE_FLING_WINDOW_MS = 100, SWIPE_SLOP_PX = 10;
  const SWIPE_TILT_DEG_PER_PX = 0.05, SWIPE_TILT_MAX_DEG = 8;
  const SWIPE_OUT_MS = 220, SWIPE_BACK_MS = 260, SWIPE_IN_MS = 180, SWIPE_IN_PX = 24;
  const SWIPE_EASE = "cubic-bezier(.2,.7,.25,1)", SWIPE_OUT_EASE = "cubic-bezier(.4,0,1,1)";
  const SWIPE_MOMENTUM_MIN_MS = 140, SWIPE_MOMENTUM_MAX_MS = 320, SWIPE_MOMENTUM_FLOOR_PX_MS = 1.5;
  function swipeDecision(dx, dy, vx) {
    if (Math.abs(dy) > Math.abs(dx)) return 0;
    const fling = Math.abs(dx) > SWIPE_SLOP_PX && Math.abs(vx) > SWIPE_FLING_PX_MS && vx * dx > 0;
    return Math.abs(dx) > SWIPE_COMMIT_PX || fling ? (dx < 0 ? 1 : -1) : 0;
  }
  function swipeOutTiming(vx, dir, dx, dist) {
    const v = Math.max(-dir * vx, SWIPE_MOMENTUM_FLOOR_PX_MS);
    const end = Math.max(dist, Math.abs(dx) + SWIPE_MOMENTUM_FLOOR_PX_MS * SWIPE_MOMENTUM_MIN_MS);
    const d = end - Math.abs(dx);
    const duration = Math.min(SWIPE_MOMENTUM_MAX_MS, Math.max(SWIPE_MOMENTUM_MIN_MS, d / v));
    const k = v * duration / d;
    const x1 = Math.min(1 / 3, 1 / k);
    const y1 = k * x1;
    const r4 = (n) => n.toFixed(4);
    return { end, duration, easing: `cubic-bezier(${r4(x1)}, ${r4(y1)}, 0.6667, 0.6667)` };
  }
  function swipeTilt(dx) {
    return Math.max(-SWIPE_TILT_MAX_DEG, Math.min(SWIPE_TILT_MAX_DEG, dx * SWIPE_TILT_DEG_PER_PX));
  }
  function swipeXf(dx) { return `translate3d(${dx}px,0,0) rotate(${swipeTilt(dx)}deg)`; }
  function releaseDecision({ dx, dy, vx, moved, cancelled, blocked, reducedMotion }) {
    const dir = blocked ? 0 : swipeDecision(dx, dy, vx);
    if (!dir && !moved) return { kind: "rest", dir: 0, eatClick: false };
    const eatClick = moved && !cancelled;
    if (reducedMotion) return { kind: "rest", dir, eatClick };
    return { kind: dir ? "fly" : "spring", dir, eatClick };
  }
  function wheelTrack(s, x) {
    s.hi = Math.max(s.hi, x);
    s.lo = Math.min(s.lo, x);
    return s.lo * 3 < s.hi && x > Math.max(4, 2 * s.lo);
  }
  return {
    COMMIT_PX: SWIPE_COMMIT_PX, FLING_PX_MS: SWIPE_FLING_PX_MS, FLING_WINDOW_MS: SWIPE_FLING_WINDOW_MS,
    SLOP_PX: SWIPE_SLOP_PX, TILT_DEG_PER_PX: SWIPE_TILT_DEG_PER_PX, TILT_MAX_DEG: SWIPE_TILT_MAX_DEG,
    OUT_MS: SWIPE_OUT_MS, BACK_MS: SWIPE_BACK_MS, IN_MS: SWIPE_IN_MS, IN_PX: SWIPE_IN_PX,
    EASE: SWIPE_EASE, OUT_EASE: SWIPE_OUT_EASE,
    MOMENTUM_MIN_MS: SWIPE_MOMENTUM_MIN_MS, MOMENTUM_MAX_MS: SWIPE_MOMENTUM_MAX_MS,
    MOMENTUM_FLOOR_PX_MS: SWIPE_MOMENTUM_FLOOR_PX_MS,
    decision: swipeDecision, outTiming: swipeOutTiming, tilt: swipeTilt, xf: swipeXf,
    releaseDecision: releaseDecision, wheelTrack: wheelTrack
  };
})();
