export function initHUD() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div id="topbar">
      <span class="stat" id="stat-hp">■ 100/100</span>
      <span class="stat" id="stat-time">0:00</span>
      <span class="stat" id="stat-info">LVL 1 · DODGE 20%</span>
    </div>
    <div id="hpbar-wrap"><div id="hpbar" style="width:100%"></div></div>
    <div id="xpbar-wrap"><div id="xpbar"></div></div>
    <div id="surge">!! SURGE !!</div>
    <div id="bossbar-wrap">
      <div id="bossbar-label">◈ SIGNAL</div>
      <div id="bossbar-track"><div id="bossbar"></div></div>
    </div>
    <canvas id="c"></canvas>
    <div id="wbar">
      <div class="ws" id="ws0"></div>
      <div class="ws" id="ws1"></div>
      <div class="ws" id="ws2"></div>
      <div class="ws" id="ws3"></div>
    </div>
    <div id="joystick-zone">
      <div id="joystick"><div id="jknob"></div></div>
    </div>
    <div id="overlay"></div>`;
}

export function updateHUD(P, gt, WDEFS) {
  const hp = Math.ceil(Math.max(0, P.hp));
  document.getElementById('stat-hp').textContent = '■ ' + hp + '/' + P.maxHp;
  const hpbar = document.getElementById('hpbar');
  hpbar.style.width = (P.hp / P.maxHp * 100) + '%';
  hpbar.style.background = P.hp < P.maxHp * 0.3 ? '#E24B4A' : P.hp < P.maxHp * 0.6 ? '#FFB627' : '#1DFFD0';
  const m = Math.floor(gt / 60), s = Math.floor(gt % 60);
  document.getElementById('stat-time').textContent = m + ':' + (s < 10 ? '0' : '') + s;
  document.getElementById('stat-info').textContent = 'LVL ' + P.level + ' · DODGE ' + Math.round(P.dodge * 100) + '%';
  document.getElementById('xpbar').style.width = (P.xp / P.xpNext * 100) + '%';
  const wids = Object.keys(P.w);
  for (let i = 0; i < 4; i++) {
    const el = document.getElementById('ws' + i); if (!el) continue;
    if (wids[i]) {
      const w = WDEFS[wids[i]];
      el.className = 'ws on';
      el.innerHTML = `<div class="wi" style="color:${w.col}">${w.icon}</div><div class="wn" style="color:${w.col}">${w.name}</div><div class="wt">T${P.w[wids[i]]}</div>`;
    } else {
      el.className = 'ws';
      el.innerHTML = `<div class="wi" style="color:#282828">—</div><div class="wn" style="color:#282828">EMPTY</div>`;
    }
  }
}

export function showOverlay(html) {
  const ov = document.getElementById('overlay');
  ov.style.display = 'flex';
  ov.innerHTML = html;
}

export function hideOverlay() {
  document.getElementById('overlay').style.display = 'none';
}

export function setSurge(visible) {
  document.getElementById('surge').style.opacity = visible ? '1' : '0';
}

export function setBossBar(boss) {
  const wrap = document.getElementById('bossbar-wrap');
  if (!boss || !boss.alive) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'flex';
  const bar = document.getElementById('bossbar');
  const pct = Math.max(0, boss.hp / boss.maxHp * 100);
  bar.style.width = pct + '%';
  bar.style.background = boss.phase === 2 ? '#D4537E' : '#E24B4A';
  document.getElementById('bossbar-label').style.color = boss.phase === 2 ? '#D4537E' : '#E24B4A';
}
