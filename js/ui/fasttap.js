// Reliable taps for HTML menus on touch screens. Some mobile browsers (notably
// in fullscreen) don't turn a tap into a "click"; this makes a short,
// still touch on a button/checkbox act as a click immediately.
const TAPPABLE = 'button, [data-cmd], [data-act], [data-tab], input[type=checkbox], .tab, .node, .cell, .slot, .row-item';

export function fastTap(root) {
  let start = null;
  root.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    start = { x: t.clientX, y: t.clientY, time: performance.now() };
  }, { passive: true });
  root.addEventListener('touchend', (e) => {
    if (!start) return;
    const t = e.changedTouches[0];
    const moved = Math.hypot(t.clientX - start.x, t.clientY - start.y);
    const quick = performance.now() - start.time < 700;
    start = null;
    if (moved > 12 || !quick) return;          // a scroll or a long press
    const hit = document.elementFromPoint(t.clientX, t.clientY);
    const el = hit && hit.closest(TAPPABLE);
    if (!el || !root.contains(el) || el.tagName === 'SELECT' || el.type === 'range' || el.type === 'number') return;
    e.preventDefault();                          // stop the (maybe missing) synthetic click
    el.click();
  }, { passive: false });
}
