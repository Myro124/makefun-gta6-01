// Seeded random (mulberry32): the same seed gives the same city and traffic,
// which is what makes the screenshot scenes repeatable.
export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Small helpers on top of a seeded random, so callers do not re-derive
// the same range/pick arithmetic in several places.
export function randomRange(random, min, max) {
  return min + random() * (max - min);
}
export function randomPick(random, list) {
  return list[Math.floor(random() * list.length)];
}
export function randomInt(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}
