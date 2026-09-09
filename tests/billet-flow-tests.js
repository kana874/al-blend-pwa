const assert=require('assert');
const fs=require('fs');
const path=require('path');
const E=require('../js/calc-engine.js');
const D=E.Decimal;
let passed=0;

function near(actual,expected,tolerance,message){
  const a=Number(D.from(actual).toString());
  assert.ok(Math.abs(a-expected)<=tolerance,`${message}: ${a} vs ${expected}`);
  passed++;
}
function has(text,needle,message){assert.ok(text.includes(needle),message||`missing: ${needle}`);passed++}

// φ145, density 2.700 g/cm3.
const unit=E.calculateBilletUnitWeight({diameterMm:'145',densityGPerCm3:'2.700'});
near(unit.areaMm2,16512.99638543135,1e-10,'phi145 area');
near(unit.volumeCm3PerM,16512.99638543135,1e-10,'phi145 volume for 1 m');
near(unit.unitWeightKgPerM,44.58509024066465,1e-11,'phi145 unit weight');

// 120 mm/min, two billets.
const flow=E.calculateBilletFlow({unitWeightKgPerM:unit.unitWeightKgPerM,castingSpeedMmPerMin:'120'});
near(flow.speedMPerMin,0.12,1e-15,'casting speed conversion');
near(flow.flowKgPerMin,5.350210828879758,1e-12,'single billet flow');
const total=E.calculateTotalCastingFlow({flowKgPerMin:flow.flowKgPerMin,billetCount:'2'});
near(total.totalFlowKgPerMin,10.700421657759517,1e-12,'two billet total flow');

// Optional 1500 mm billet length.
const weight=E.calculateBilletWeight({unitWeightKgPerM:unit.unitWeightKgPerM,billetLengthMm:'1500',billetCount:'2'});
near(weight.billetLengthM,1.5,1e-15,'billet length conversion');
near(weight.oneBilletWeightKg,66.87763536099698,1e-11,'single billet weight');
near(weight.totalBilletWeightKg,133.75527072199395,1e-11,'two billet total weight');

// Measured unit weight path uses the supplied kg/m value directly.
const measuredFlow=E.calculateBilletFlow({unitWeightKgPerM:'44.3',castingSpeedMmPerMin:'125'});
near(measuredFlow.flowKgPerMin,5.5375,1e-15,'measured unit weight flow');

assert.throws(()=>E.calculateBilletUnitWeight({diameterMm:'0',densityGPerCm3:'2.7'}),/> 0/);passed++;
assert.throws(()=>E.calculateBilletFlow({unitWeightKgPerM:'44',castingSpeedMmPerMin:'0'}),/> 0/);passed++;
assert.throws(()=>E.calculateTotalCastingFlow({flowKgPerMin:'5',billetCount:'1.5'}),/positive integer/);passed++;
assert.throws(()=>E.calculateBilletWeight({unitWeightKgPerM:'44',billetLengthMm:'-1',billetCount:'1'}),/> 0/);passed++;

// Static wiring / offline integration checks.
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const billetJs=fs.readFileSync(path.join(root,'js','billet-flow.js'),'utf8');
const billetCss=fs.readFileSync(path.join(root,'css','billet-flow.css'),'utf8');
const uiPatch=fs.readFileSync(path.join(root,'js','ui-v1.5.js'),'utf8');
const sw=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');

has(html,'css/billet-flow.css?v=20260909','billet CSS loaded on first visit');
has(html,'js/billet-flow.js?v=20260909','billet JS loaded on first visit');
has(billetJs,'3. ビレット・流量計算','billet calculator panel');
has(billetJs,'φ145','phi145 diameter preset');
has(billetJs,'φ178','phi178 diameter preset');
has(billetJs,'実測単重を使用','measured unit weight mode');
has(billetJs,'計算過程を表示','educational calculation process');
has(billetJs,"type:'ビレット・流量'",'calculation history type');
has(billetJs,'processText','calculation process persisted to history');
has(billetJs,'kg/m × m/min','unit cancellation explanation');
has(billetCss,'.billet-flow-panel','billet responsive styles');
has(uiPatch,"casting:{label:'ビレット・流量'",'billet history tab');
has(uiPatch,'casting-history-detail','history process viewer');
has(sw,"const CACHE='al-blend-pwa-v1.5.3'",'service worker cache bump');
has(sw,"'./css/billet-flow.css?v=20260909'",'billet CSS offline cache');
has(sw,"'./js/billet-flow.js?v=20260909'",'billet JS offline cache');

console.log(`PASS: ${passed} billet-flow assertions`);
