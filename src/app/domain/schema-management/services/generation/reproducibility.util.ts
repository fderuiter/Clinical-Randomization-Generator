import seedrandom from 'seedrandom';

export class ReproducibilityUtil {
  static get128BitHash(seed: string | undefined): string {
    const s = seed || '';
    if (/^[0-9a-f]{32}$/i.test(s)) {
      return s.toLowerCase();
    }
    const rng = seedrandom(s);
    const arr = new Uint32Array(4);
    for (let i = 0; i < 4; i++) {
      arr[i] = Math.abs(rng.int32());
    }
    return Array.from(arr, n => n.toString(16).padStart(8, '0')).join('');
  }

  static hashCode(str: string | undefined): number {
    const hex128 = this.get128BitHash(str);
    let hash = 2166136261;
    for (let i = 0; i < hex128.length; i++) {
      hash ^= hex128.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
      hash |= 0;
    }
    return (hash >>> 0) % 2147483647;
  }
}
