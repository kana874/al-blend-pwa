/* DecimalLite v1.0.0 - dependency-free arbitrary precision decimal arithmetic for Al Blend PWA.
 * Stores decimals as BigInt coefficient + base-10 scale. Supports the operations required by the app.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DecimalLite = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const POW10 = [1n];
  function pow10(n) {
    n = Number(n);
    if (n < 0 || !Number.isInteger(n)) throw new Error('Invalid power');
    while (POW10.length <= n) POW10.push(POW10[POW10.length - 1] * 10n);
    return POW10[n];
  }

  function normalize(n, s) {
    if (n === 0n) return { n: 0n, s: 0 };
    while (s > 0 && n % 10n === 0n) {
      n /= 10n;
      s -= 1;
    }
    return { n, s };
  }

  function parseValue(value) {
    if (value instanceof DecimalLite) return { n: value.n, s: value.s };
    if (typeof value === 'bigint') return { n: value, s: 0 };
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new Error('Non-finite decimal');
      value = String(value);
    }
    if (typeof value !== 'string') value = String(value);
    let str = value.trim();
    if (!str) throw new Error('Empty decimal');
    let sign = 1n;
    if (str[0] === '+') str = str.slice(1);
    else if (str[0] === '-') { sign = -1n; str = str.slice(1); }

    const m = str.match(/^(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/);
    if (!m || (!m[1] && !m[2])) throw new Error('Invalid decimal: ' + value);
    const intPart = m[1] || '0';
    const fracPart = m[2] || '';
    const exp = parseInt(m[3] || '0', 10);
    let digits = (intPart + fracPart).replace(/^0+(?=\d)/, '') || '0';
    let scale = fracPart.length - exp;
    let n = BigInt(digits) * sign;
    if (scale < 0) {
      n *= pow10(-scale);
      scale = 0;
    }
    return normalize(n, scale);
  }

  function roundedQuotient(num, den, mode) {
    if (den === 0n) throw new Error('Division by zero');
    let sign = 1n;
    if (num < 0n) { num = -num; sign = -sign; }
    if (den < 0n) { den = -den; sign = -sign; }
    const q = num / den;
    const r = num % den;
    if (r === 0n) return q * sign;

    let inc = false;
    switch (mode) {
      case 'half-up': inc = (r * 2n >= den); break;
      case 'ceil': inc = sign > 0n; break;
      case 'floor': inc = sign < 0n; break;
      case 'trunc': inc = false; break;
      default: throw new Error('Unknown rounding mode: ' + mode);
    }
    return (q + (inc ? 1n : 0n)) * sign;
  }

  class DecimalLite {
    constructor(value, _scale) {
      if (_scale !== undefined) {
        const z = normalize(BigInt(value), Number(_scale));
        this.n = z.n; this.s = z.s;
      } else {
        const z = parseValue(value);
        this.n = z.n; this.s = z.s;
      }
      Object.freeze(this);
    }

    static from(v) { return v instanceof DecimalLite ? v : new DecimalLite(v); }
    static zero() { return new DecimalLite(0); }
    static one() { return new DecimalLite(1); }

    align(other) {
      other = DecimalLite.from(other);
      const s = Math.max(this.s, other.s);
      return [this.n * pow10(s - this.s), other.n * pow10(s - other.s), s];
    }

    add(other) {
      const [a, b, s] = this.align(other);
      return new DecimalLite(a + b, s);
    }
    sub(other) {
      const [a, b, s] = this.align(other);
      return new DecimalLite(a - b, s);
    }
    mul(other) {
      other = DecimalLite.from(other);
      return new DecimalLite(this.n * other.n, this.s + other.s);
    }
    div(other, precision = 40, mode = 'half-up') {
      other = DecimalLite.from(other);
      if (other.n === 0n) throw new Error('Division by zero');
      precision = Math.max(0, Math.floor(precision));
      const exp = other.s + precision - this.s;
      let num = this.n;
      let den = other.n;
      if (exp >= 0) num *= pow10(exp);
      else den *= pow10(-exp);
      const q = roundedQuotient(num, den, mode);
      return new DecimalLite(q, precision);
    }
    abs() { return this.n < 0n ? new DecimalLite(-this.n, this.s) : this; }
    neg() { return new DecimalLite(-this.n, this.s); }
    cmp(other) {
      const [a, b] = this.align(other);
      return a < b ? -1 : a > b ? 1 : 0;
    }
    eq(o) { return this.cmp(o) === 0; }
    lt(o) { return this.cmp(o) < 0; }
    lte(o) { return this.cmp(o) <= 0; }
    gt(o) { return this.cmp(o) > 0; }
    gte(o) { return this.cmp(o) >= 0; }
    isZero() { return this.n === 0n; }

    round(dp = 0, mode = 'half-up') {
      dp = Math.max(0, Math.floor(dp));
      if (this.s <= dp) return this;
      const cut = this.s - dp;
      const den = pow10(cut);
      const q = roundedQuotient(this.n, den, mode);
      return new DecimalLite(q, dp);
    }

    quantize(step, mode = 'half-up') {
      step = DecimalLite.from(step);
      if (step.lte(0)) throw new Error('Step must be > 0');
      const units = this.div(step, 0, mode);
      return units.mul(step);
    }

    toString() {
      if (this.n === 0n) return '0';
      const neg = this.n < 0n;
      let digits = (neg ? -this.n : this.n).toString();
      if (this.s === 0) return (neg ? '-' : '') + digits;
      if (digits.length <= this.s) digits = '0'.repeat(this.s - digits.length + 1) + digits;
      const p = digits.length - this.s;
      let out = digits.slice(0, p) + '.' + digits.slice(p);
      out = out.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
      return (neg ? '-' : '') + out;
    }

    toFixed(dp = 0, mode = 'half-up') {
      dp = Math.max(0, Math.floor(dp));
      const r = this.round(dp, mode);
      const neg = r.n < 0n;
      let digits = (neg ? -r.n : r.n).toString();
      const scale = r.s;
      if (scale === 0) {
        return (neg ? '-' : '') + digits + (dp ? '.' + '0'.repeat(dp) : '');
      }
      if (digits.length <= scale) digits = '0'.repeat(scale - digits.length + 1) + digits;
      const p = digits.length - scale;
      let intPart = digits.slice(0, p);
      let frac = digits.slice(p);
      if (frac.length < dp) frac += '0'.repeat(dp - frac.length);
      else if (frac.length > dp) frac = frac.slice(0, dp);
      return (neg ? '-' : '') + intPart + (dp ? '.' + frac : '');
    }

    toNumber() { return Number(this.toString()); }
    toJSON() { return this.toString(); }
  }

  DecimalLite.VERSION = '1.0.0';
  return DecimalLite;
});
