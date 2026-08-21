const assert=require('assert');
const E=require('../js/calc-engine.js');
const D=E.Decimal;
let passed=0;
function near(actual,expected,tol,msg){const a=Number(D.from(actual).toString()),e=Number(expected);assert.ok(Math.abs(a-e)<=tol,`${msg||''}: ${a} vs ${e}`);passed++;}
function eq(actual,expected,msg){assert.strictEqual(D.from(actual).toString(),D.from(expected).toString(),msg);passed++;}

// unit conversions
eq(E.massToGram('1','kg'),'1000','1 kg -> g');
eq(E.massToGram('1','t'),'1000000','1 t -> g');
eq(E.concentrationToFraction('1','ppm'),'0.000001','1 ppm fraction');
eq(E.fractionToConcentration('0.000001','ppm'),'1','fraction -> ppm');

// sample addition: 500 kg, Cu 2 -> 50 ppm, Cu 99.999 wt%, Y=95%
const M=E.massToGram('500','kg');
const C0=E.concentrationToFraction('2','ppm');
const Ct=E.concentrationToFraction('50','ppm');
const P=E.percentToFraction('99.999');
const Y=E.percentToFraction('95');
const x=E.calculateAdditionMass({meltMassG:M,currentFraction:C0,targetFraction:Ct,additiveFraction:P,yieldFraction:Y});
const C1=E.calculateFinalConcentration({meltMassG:M,currentFraction:C0,additionMassG:x,additiveFraction:P,yieldFraction:Y});
near(E.fractionToConcentration(C1,'ppm'),'50',1e-20,'addition round trip');

// yield round trip
const Yr=E.calculateYield({meltMassG:M,currentFraction:C0,finalFraction:C1,additionMassG:x,additiveFraction:P});
near(Yr,'0.95',1e-20,'yield round trip');

// dilution 60 -> 50 ppm with clean Al should add 100 kg
const dx=E.calculateDilutionMass({meltMassG:M,currentFraction:E.concentrationToFraction('60','ppm'),targetFraction:Ct,diluentFraction:E.concentrationToFraction('0','ppm')});
eq(dx,'100000','dilution');

// multi-element coupled mass balance
const rows=[
 {element:'Cu',currentFraction:E.concentrationToFraction('2','ppm'),targetFraction:E.concentrationToFraction('50','ppm'),additiveFraction:E.percentToFraction('99.999'),yieldFraction:E.percentToFraction('95')},
 {element:'Ti',currentFraction:E.concentrationToFraction('1','ppm'),targetFraction:E.concentrationToFraction('20','ppm'),additiveFraction:E.percentToFraction('5'),yieldFraction:E.percentToFraction('90')}
];
const batch=E.calculateMultiElementBatch({meltMassG:M,rows});
const finals=E.finalConcentrationsForBatch({meltMassG:M,rows:batch.rows,additionMassesG:batch.rows.map(r=>r.theoreticalMassG)});
near(E.fractionToConcentration(finals[0],'ppm'),'50',1e-18,'multi Cu');
near(E.fractionToConcentration(finals[1],'ppm'),'20',1e-18,'multi Ti');

// rounding
const q=D.from('1.23456').quantize('0.01','half-up');eq(q,'1.23','half-up quantize');
eq(D.from('1.235').quantize('0.01','half-up'),'1.24','half-up tie');
eq(D.from('1.231').quantize('0.01','ceil'),'1.24','ceil');
eq(D.from('1.239').quantize('0.01','floor'),'1.23','floor');

console.log(`PASS: ${passed} assertions`);
console.log(`Sample theoretical Cu addition = ${x.toFixed(9)} g`);
