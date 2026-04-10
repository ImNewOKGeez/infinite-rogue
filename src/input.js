export const keys = {};
export const jDir = { x: 0, y: 0 };
let jBase = null, jOn = false;

export function initInput() {
  window.addEventListener('keydown', e => keys[e.key] = true);
  window.addEventListener('keyup', e => keys[e.key] = false);

  setInterval(() => {
    if (!jOn) {
      let x = 0, y = 0;
      if (keys['ArrowLeft'] || keys['a'] || keys['A']) x = -1;
      if (keys['ArrowRight'] || keys['d'] || keys['D']) x = 1;
      if (keys['ArrowUp'] || keys['w'] || keys['W']) y = -1;
      if (keys['ArrowDown'] || keys['s'] || keys['S']) y = 1;
      const l = Math.sqrt(x * x + y * y) || 1;
      jDir.x = x ? x / l : 0;
      jDir.y = y ? y / l : 0;
    }
  }, 16);
}

export function initJoystick(jZone, joystick, knob) {
  jZone.addEventListener('touchstart', e => {
    const t = e.changedTouches[0];
    jBase = { x: t.clientX, y: t.clientY };
    joystick.style.left = t.clientX + 'px';
    joystick.style.top = t.clientY + 'px';
    joystick.style.display = 'block';
    jOn = true;
    e.preventDefault();
  }, { passive: false });

  jZone.addEventListener('touchmove', e => {
    if (!jOn) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - jBase.x, dy = t.clientY - jBase.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1, max = 44;
    knob.style.left = (50 + (dx / d) * Math.min(d, max) / 96 * 100) + '%';
    knob.style.top = (50 + (dy / d) * Math.min(d, max) / 96 * 100) + '%';
    jDir.x = dx / d;
    jDir.y = dy / d;
    e.preventDefault();
  }, { passive: false });

  function jStop(e) {
    e?.preventDefault();
    jOn = false; jDir.x = 0; jDir.y = 0;
    joystick.style.display = 'none';
    knob.style.left = '50%'; knob.style.top = '50%';
  }
  jZone.addEventListener('touchend', jStop, { passive: false });
  jZone.addEventListener('touchcancel', jStop, { passive: false });
}
