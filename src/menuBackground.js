function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export class MenuBackground {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.nodes = [];
    this.connections = [];
    this.packets = [];
    this.running = false;
    this.animFrame = null;
    this.gt = 0;
    this.lastTime = 0;
    this._onResize = () => this.resize();
    this.init();
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  init() {
    this.resize();
    window.addEventListener('resize', this._onResize);
    const count = 80;
    this.nodes = Array.from({ length: count }, () => ({
      x: Math.random() * this.canvas.width,
      y: Math.random() * this.canvas.height,
      pulses: Math.random() < 0.25,
      pulseOffset: Math.random() * Math.PI * 2,
      r: 2.5 + Math.random() * 1.5,
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.5) * 4,
    }));

    this.connections = [];
    this.nodes.forEach((a, i) => {
      const distances = this.nodes
        .map((b, j) => ({ j, d: Math.hypot(b.x - a.x, b.y - a.y) }))
        .filter(({ j, d }) => j !== i && d < 200)
        .sort((lhs, rhs) => lhs.d - rhs.d)
        .slice(0, 3);
      distances.forEach(({ j }) => {
        if (!this.connections.find(c => (c.a === i && c.b === j) || (c.a === j && c.b === i))) {
          this.connections.push({ a: i, b: j });
        }
      });
    });

    for (let i = 0; i < 5; i++) this.spawnPacket();
  }

  spawnPacket() {
    if (!this.connections.length) return;
    const connIdx = Math.floor(Math.random() * this.connections.length);
    this.packets.push({ connIdx, t: 0, speed: 0.008 + Math.random() * 0.012 });
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.canvas.classList.add('visible');
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  stop() {
    this.running = false;
    this.canvas.classList.remove('visible');
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
    this.animFrame = null;
  }

  loop(ts) {
    if (!this.running) return;
    const dt = Math.min((ts - this.lastTime) / 1000, 0.05);
    this.lastTime = ts;
    this.gt += dt;
    this.update(dt);
    this.draw();
    this.animFrame = requestAnimationFrame(next => this.loop(next));
  }

  update(dt) {
    this.nodes.forEach(node => {
      node.x += node.vx * dt;
      node.y += node.vy * dt;
      if (node.x < 0 || node.x > this.canvas.width) node.vx *= -1;
      if (node.y < 0 || node.y > this.canvas.height) node.vy *= -1;
      node.x = clamp(node.x, 0, this.canvas.width);
      node.y = clamp(node.y, 0, this.canvas.height);
    });

    this.packets.forEach(packet => {
      packet.t += packet.speed;
    });
    this.packets = this.packets.filter(packet => packet.t < 1);
    while (this.packets.length < 5) this.spawnPacket();
  }

  draw() {
    const { ctx, canvas, gt } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(0,207,255,0.06)';
    ctx.lineWidth = 1;

    this.connections.forEach(connection => {
      const a = this.nodes[connection.a];
      const b = this.nodes[connection.b];
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    });

    this.nodes.forEach(node => {
      const pulse = node.pulses ? 0.8 + 0.2 * Math.sin(gt * 1.5 + node.pulseOffset) : 1;
      ctx.fillStyle = 'rgba(0,207,255,0.15)';
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.r * pulse, 0, Math.PI * 2);
      ctx.fill();
    });

    this.packets.forEach(packet => {
      const connection = this.connections[packet.connIdx];
      if (!connection) return;
      const a = this.nodes[connection.a];
      const b = this.nodes[connection.b];
      const x = a.x + (b.x - a.x) * packet.t;
      const y = a.y + (b.y - a.y) * packet.t;
      ctx.fillStyle = 'rgba(0,207,255,0.4)';
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}
