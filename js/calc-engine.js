(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./vendor/decimal-lite.js'));
  else root.CalcEngine = factory(root.DecimalLite);
})(typeof self !== 'undefined' ? self : this, function (D) {
  'use strict';
  if (!D) throw new Error('DecimalLite is required');

  const MASS_TO_G = { mg: '0.001', g: '1', kg: '1000', t: '1000000' };
  const CONC_DIV = { 'wt%': '100', ppm: '1000000', ppb: '1000000000' };
  const DP = 48;

  function dec(v, name = 'value') {
    try { return D.from(v); }
    catch (e) { throw new Error(name + ' is invalid'); }
  }

  function assertPositive(v, name) { if (v.lte(0)) throw new Error(name + ' must be > 0'); }
  function assertNonNegative(v, name) { if (v.lt(0)) throw new Error(name + ' must be >= 0'); }

  function massToGram(value, unit) {
    if (!MASS_TO_G[unit]) throw new Error('Unsupported mass unit: ' + unit);
    const x = dec(value, 'mass'); assertNonNegative(x, 'mass');
    return x.mul(MASS_TO_G[unit]);
  }

  function gramToMass(valueG, unit) {
    if (!MASS_TO_G[unit]) throw new Error('Unsupported mass unit: ' + unit);
    return dec(valueG).div(MASS_TO_G[unit], DP);
  }

  function gramToDisplayMass(valueG, unit = 'auto') {
    const g = dec(valueG);
    if (unit !== 'auto') return { value: gramToMass(g, unit), unit };
    const a = g.abs();
    if (a.gte('1000000')) return { value: gramToMass(g, 't'), unit: 't' };
    if (a.gte('1000')) return { value: gramToMass(g, 'kg'), unit: 'kg' };
    if (a.lt('1') && !a.isZero()) return { value: gramToMass(g, 'mg'), unit: 'mg' };
    return { value: g, unit: 'g' };
  }

  function concentrationToFraction(value, unit) {
    if (!CONC_DIV[unit]) throw new Error('Unsupported concentration unit: ' + unit);
    const x = dec(value, 'concentration'); assertNonNegative(x, 'concentration');
    return x.div(CONC_DIV[unit], DP);
  }

  function fractionToConcentration(frac, unit) {
    if (!CONC_DIV[unit]) throw new Error('Unsupported concentration unit: ' + unit);
    return dec(frac).mul(CONC_DIV[unit]);
  }

  function percentToFraction(percent, name = 'percent') {
    const p = dec(percent, name); assertNonNegative(p, name);
    return p.div(100, DP);
  }

  function calculateAdditionMass({ meltMassG, currentFraction, targetFraction, additiveFraction, yieldFraction }) {
    const M = dec(meltMassG, 'melt mass'); assertPositive(M, 'melt mass');
    const C0 = dec(currentFraction, 'current concentration'); assertNonNegative(C0, 'current concentration');
    const Ct = dec(targetFraction, 'target concentration'); assertNonNegative(Ct, 'target concentration');
    const P = dec(additiveFraction, 'additive fraction'); assertPositive(P, 'additive fraction');
    const Y = dec(yieldFraction, 'yield'); assertPositive(Y, 'yield');
    if (C0.gt(Ct)) throw new Error('Current concentration exceeds target; use dilution calculation');
    if (C0.eq(Ct)) return D.zero();
    const denom = P.mul(Y).sub(Ct);
    if (denom.lte(0)) throw new Error('Target concentration is at or above effective additive concentration');
    return M.mul(Ct.sub(C0)).div(denom, DP);
  }

  function calculateFinalConcentration({ meltMassG, currentFraction, additionMassG, additiveFraction, yieldFraction, totalOtherAdditionG = 0 }) {
    const M = dec(meltMassG); assertPositive(M, 'melt mass');
    const C0 = dec(currentFraction); assertNonNegative(C0, 'current concentration');
    const x = dec(additionMassG); assertNonNegative(x, 'addition mass');
    const P = dec(additiveFraction); assertPositive(P, 'additive fraction');
    const Y = dec(yieldFraction); assertNonNegative(Y, 'yield');
    const other = dec(totalOtherAdditionG); assertNonNegative(other, 'other additions');
    const numerator = M.mul(C0).add(x.mul(P).mul(Y));
    const denominator = M.add(x).add(other);
    return numerator.div(denominator, DP);
  }

  function calculateYield({ meltMassG, currentFraction, finalFraction, additionMassG, additiveFraction }) {
    const M = dec(meltMassG); assertPositive(M, 'melt mass');
    const C0 = dec(currentFraction); assertNonNegative(C0, 'current concentration');
    const C1 = dec(finalFraction); assertNonNegative(C1, 'final concentration');
    const x = dec(additionMassG); assertPositive(x, 'addition mass');
    const P = dec(additiveFraction); assertPositive(P, 'additive fraction');
    const numerator = C1.mul(M.add(x)).sub(M.mul(C0));
    return numerator.div(x.mul(P), DP);
  }

  function calculateDilutionMass({ meltMassG, currentFraction, targetFraction, diluentFraction }) {
    const M = dec(meltMassG); assertPositive(M, 'melt mass');
    const C0 = dec(currentFraction); assertNonNegative(C0, 'current concentration');
    const Ct = dec(targetFraction); assertNonNegative(Ct, 'target concentration');
    const Cd = dec(diluentFraction); assertNonNegative(Cd, 'diluent concentration');
    if (!C0.gt(Ct)) throw new Error('Current concentration must be greater than target');
    if (!Ct.gt(Cd)) throw new Error('Diluent concentration must be lower than target');
    return M.mul(C0.sub(Ct)).div(Ct.sub(Cd), DP);
  }

  function calculateRoundedScenarios({ theoreticalMassG, resolutionG, finalConcentrationFn, roundingMode = 'half-up' }) {
    const x = dec(theoreticalMassG); assertNonNegative(x, 'theoretical mass');
    const r = dec(resolutionG); assertPositive(r, 'resolution');
    const nearest = x.quantize(r, 'half-up');
    const lower = x.quantize(r, 'floor');
    const upper = x.quantize(r, 'ceil');
    const preferred = roundingMode === 'ceil' ? upper : roundingMode === 'floor' ? lower : nearest;
    const unique = [];
    const seen = new Set();
    for (const [kind, mass] of [['lower', lower], ['nearest', nearest], ['upper', upper]]) {
      const key = mass.toString();
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push({ kind, massG: mass, finalFraction: finalConcentrationFn ? finalConcentrationFn(mass) : null });
    }
    return { preferredMassG: preferred, lowerMassG: lower, nearestMassG: nearest, upperMassG: upper, scenarios: unique };
  }

  // Exact coupled solution for multiple independent additives under Model A.
  // Each additive changes the common final total mass; cross-element chemistry is deferred to Ver.2.
  function calculateMultiElementBatch({ meltMassG, rows }) {
    const M = dec(meltMassG); assertPositive(M, 'melt mass');
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('At least one element is required');
    const prepared = rows.map((r, idx) => {
      const C0 = dec(r.currentFraction, `row ${idx + 1} current`);
      const Ct = dec(r.targetFraction, `row ${idx + 1} target`);
      const P = dec(r.additiveFraction, `row ${idx + 1} additive`);
      const Y = dec(r.yieldFraction, `row ${idx + 1} yield`);
      assertNonNegative(C0, 'current concentration'); assertNonNegative(Ct, 'target concentration');
      assertPositive(P, 'additive fraction'); assertPositive(Y, 'yield');
      if (C0.gt(Ct)) throw new Error(`${r.element || 'Element'} current concentration exceeds target`);
      const PY = P.mul(Y);
      if (Ct.gte(PY)) throw new Error(`${r.element || 'Element'} target is at or above effective additive concentration`);
      // x_i = a_i + b_i*S where S = total addition mass.
      const a = M.mul(Ct.sub(C0)).div(PY, DP);
      const b = Ct.div(PY, DP);
      return { ...r, C0, Ct, P, Y, a, b };
    });

    const A = prepared.reduce((s, r) => s.add(r.a), D.zero());
    const B = prepared.reduce((s, r) => s.add(r.b), D.zero());
    const oneMinusB = D.one().sub(B);
    if (oneMinusB.lte(0)) throw new Error('Combined targets are mathematically infeasible');
    const totalAdditionG = A.div(oneMinusB, DP);
    const outRows = prepared.map(r => {
      const x = r.a.add(r.b.mul(totalAdditionG));
      return { ...r, theoreticalMassG: x };
    });
    const finalMassG = M.add(totalAdditionG);
    return { rows: outRows, totalAdditionG, finalMassG };
  }

  function finalConcentrationsForBatch({ meltMassG, rows, additionMassesG }) {
    const M = dec(meltMassG); assertPositive(M, 'melt mass');
    const masses = additionMassesG.map(dec);
    const S = masses.reduce((s, x) => s.add(x), D.zero());
    const denominator = M.add(S);
    return rows.map((r, i) => {
      const C0 = dec(r.currentFraction);
      const P = dec(r.additiveFraction);
      const Y = dec(r.yieldFraction);
      const numerator = M.mul(C0).add(masses[i].mul(P).mul(Y));
      return numerator.div(denominator, DP);
    });
  }

  return {
    VERSION: '1.0.3', Decimal: D, massToGram, gramToMass, gramToDisplayMass,
    concentrationToFraction, fractionToConcentration, percentToFraction,
    calculateAdditionMass, calculateFinalConcentration, calculateYield,
    calculateDilutionMass, calculateRoundedScenarios, calculateMultiElementBatch,
    finalConcentrationsForBatch
  };
});
