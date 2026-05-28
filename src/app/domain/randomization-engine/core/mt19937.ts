import seedrandom from 'seedrandom';

export class MT19937 {
  private mt: Uint32Array;
  private mti: number;

  constructor(seed: number) {
    this.mt = new Uint32Array(624);
    this.mt[0] = seed >>> 0;
    for (this.mti = 1; this.mti < 624; this.mti++) {
      const prev = this.mt[this.mti - 1];
      this.mt[this.mti] =
        (1812433253 * (prev ^ (prev >>> 30)) + this.mti) >>> 0;
    }
  }

  private random_int(): number {
    const mag01 = new Uint32Array([0x0, 0x9908b0df]);
    let y: number;

    if (this.mti >= 624) {
      let kk: number;
      for (kk = 0; kk < 227; kk++) {
        y = (this.mt[kk] & 0x80000000) | (this.mt[kk + 1] & 0x7fffffff);
        this.mt[kk] = this.mt[kk + 397] ^ (y >>> 1) ^ mag01[y & 0x1];
      }
      for (; kk < 623; kk++) {
        y = (this.mt[kk] & 0x80000000) | (this.mt[kk + 1] & 0x7fffffff);
        this.mt[kk] = this.mt[kk - 227] ^ (y >>> 1) ^ mag01[y & 0x1];
      }
      y = (this.mt[623] & 0x80000000) | (this.mt[0] & 0x7fffffff);
      this.mt[623] = this.mt[396] ^ (y >>> 1) ^ mag01[y & 0x1];

      this.mti = 0;
    }

    y = this.mt[this.mti++];

    y ^= (y >>> 11);
    y ^= (y << 7) & 0x9d2c5680;
    y ^= (y << 15) & 0xefc60000;
    y ^= (y >>> 18);

    return y >>> 0;
  }

  random(): number {
    return this.random_int() * (1.0 / 4294967296.0);
  }

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

  static get31BitSeed(str: string | undefined): number {
    const hex128 = MT19937.get128BitHash(str);
    let hash = 2166136261;
    for (let i = 0; i < hex128.length; i++) {
      hash ^= hex128.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
      hash |= 0;
    }
    return (hash >>> 0) % 2147483647;
  }
}
