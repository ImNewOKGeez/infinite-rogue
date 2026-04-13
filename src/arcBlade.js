export const ARC_BLADE_TIERS = {
  1: { discCount: 1, rx: 55, ry: 35, thetaSpeed: 3.2, dmgMult: 1.0, pierce: false },
  2: { discCount: 1, rx: 65, ry: 42, thetaSpeed: 3.2, dmgMult: 1.3, pierce: false },
  3: { discCount: 2, rx: 75, ry: 48, thetaSpeed: 3.0, dmgMult: 1.3, pierce: false },
  4: { discCount: 2, rx: 85, ry: 55, thetaSpeed: 2.8, dmgMult: 1.4, pierce: false },
  5: { discCount: 3, rx: 95, ry: 62, thetaSpeed: 2.6, dmgMult: 1.5, pierce: false },
};

export function getDiscAngle(discIndex, discCount, baseAngle) {
  if (discCount === 1) return baseAngle;
  if (discCount === 2) return discIndex === 0 ? baseAngle : baseAngle + Math.PI;
  if (discCount === 3) return baseAngle + (discIndex / 3) * Math.PI * 2;
  return baseAngle + (discIndex / discCount) * Math.PI * 2;
}

export function quadPoint(a, c, b, t) {
  return ((1 - t) * (1 - t) * a) + (2 * (1 - t) * t * c) + (t * t * b);
}
