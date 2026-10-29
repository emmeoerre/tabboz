/* Calls the original C save routine exported by our source-built engine.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
(() => {
  "use strict";
  function flushSave() {
    const state = window.Asyncify;
    if (!state || state.state !== 0 || !Array.isArray(state.exportCallStack) || state.exportCallStack.length || typeof window._SalvaTutto !== "function") return false;
    window._SalvaTutto();
    return true;
  }
  window.EngineBridge = { install() {}, flushSave };
})();
