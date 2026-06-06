/**
 * Tiny pure throttle factory. Given a `thresholdMs` window and a
 * monotonic `now` clock, returns a `tryAdmit()` function that returns
 * `true` if the caller is allowed to fire the throttled action and
 * `false` if it should drop. State (the timestamp of the last admitted
 * call) lives in the returned closure — concurrent throttlers don't
 * interfere.
 *
 * The first call always admits: the "never fired" sentinel is
 * `-Infinity`, NOT `0`. Initializing to `0` would treat "no prior
 * call" as "fired at t=0" and silently drop early-window calls when
 * `now()` returns a small monotonic value (e.g. `performance.now()`
 * within the first `thresholdMs` of `timeOrigin`).
 *
 * The `now` parameter is required (no default) so consumers must be
 * explicit about which clock they're using — `performance.now()`
 * (monotonic, immune to wall-clock jumps) vs `Date.now()` (wall-clock,
 * subject to NTP adjustments). This file is dependency-injection-
 * shaped so unit tests can stub `now` and assert exact timing.
 *
 * @param {object} options
 * @param {number} options.thresholdMs - Minimum gap between admitted
 *   calls. Calls inside the window return `false`.
 * @param {() => number} options.now - Clock function returning a
 *   monotonic timestamp in milliseconds.
 * @returns {() => boolean} `tryAdmit` — `true` if admitted, `false` if
 *   throttled.
 */
export function makeThrottle({ thresholdMs, now }) {
  let lastAdmittedAt = -Infinity;
  return function tryAdmit() {
    const t = now();
    if (t - lastAdmittedAt < thresholdMs) return false;
    lastAdmittedAt = t;
    return true;
  };
}
