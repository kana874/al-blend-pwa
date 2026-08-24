const assert=require('assert');
const E=require('../js/calc-engine.js');
const D=E.Decimal;
let passed=0;
function near(actual,expected,tol,msg){const a=Number(D.from(actual).toString()),e=Number(expected);assert.ok(Math.abs(a-e)<=tol,`${msg||''}: ${a} vs ${e}`);passed++;}
function eq(actual,expected,msg){assert.strictEqual(D.from(actual).toString(),D.from(expected).toString(),msg);passed++;}

// unit conversions
eq(E.massToGram('1','kg'),'1000','1 kg -> g');
eq(E.massToGram('0.001','kg'),'1','0.001 kg scale resolution -> 1 g');
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

// Ver.1.0.3 sample: 1900 kg, Cu 0.1 ppm -> 0.5 wt%, Cu 99.999 wt%, Y=100%, 1 g balance
const M103=E.massToGram('1900','kg');
const C0103=E.concentrationToFraction('0.1','ppm');
const Ct103=E.concentrationToFraction('0.5','wt%');
const P103=E.percentToFraction('99.999');
const Y103=E.percentToFraction('100');
const x103=E.calculateAdditionMass({meltMassG:M103,currentFraction:C0103,targetFraction:Ct103,additiveFraction:P103,yieldFraction:Y103});
near(x103,'9547.6436949115',1e-9,'v1.0.3 sample theoretical addition');
const xr103=D.from(x103).quantize('1','half-up');
eq(xr103,'9548','v1.0.3 sample 1 g rounding');
const C1103=E.calculateFinalConcentration({meltMassG:M103,currentFraction:C0103,additionMassG:xr103,additiveFraction:P103,yieldFraction:Y103});
near(E.fractionToConcentration(C1103,'wt%'),'0.5000185656500911',1e-12,'v1.0.3 sample rounded final concentration');

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


// Ver.1.0.10 static integration checks
const fs=require('fs');
const path=require('path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'..','js','app.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'..','css','app.css'),'utf8');
function has(text,needle,msg){assert.ok(text.includes(needle),msg||`missing: ${needle}`);passed++;}
has(html,'Ver.1.0.10','version label');
has(css,'.brand small{display:block;opacity:.82;font-size:10px','mobile version remains visible');
has(html,'id="blendPresetSelect"','preset selector');
has(html,'id="exportScaleCsv"','scale CSV export');
has(html,'id="exportAdditiveCsv"','additive CSV export');
has(app,"kind:'blendPreset'",'preset persistence');
has(app,'await saveBlendHistory(true)','automatic blend history');
has(app,'function renderBlendElementSummary','multi-element summary renderer');
has(app,'await loadHistory();','history list refresh after persistence');
has(app,'計算履歴の自動保存に失敗しました。','history save failure is separated from calculation failure');
has(app,"type:'歩留まり逆算'",'automatic yield calculation history');
has(app,'class="ghost scale-edit"','scale edit action');
has(app,'class="ghost add-edit"','additive edit action');
has(html,'id="blendSummaryGrid" class="summary-grid"','summary grid mount');
has(app,"grid.querySelectorAll('.summary-element-item')",'summary cleanup');
has(app,"card.className='summary-element-item'",'summary per-element card creation');
has(app,'<select class="row-element row-element-select"','blend element is select-only');
has(css,'.element-select-field::after{content:"▼"','element dropdown arrow is always visible');
assert.ok(!app.includes('<input class="row-element"'),'blend element must not be free-text input');passed++;
has(app,"availableElements().includes(element)",'master-only element validation');
has(app,'元素は添加材マスタの主元素からドロップダウンで選択してください。','dropdown validation message');
assert.ok((app.match(/persistCalculationHistory\(/g)||[]).length>=5,'all calculation paths must use common history persistence');passed++;
has(app,'`${String(r?.element||`元素${i+1}`)} 添加量`','element summary labels include 添加量');
has(app,'renderBlendElementSummary(rows,preferred,res,scale);','summary uses collected input rows');
has(html,'js/app.js?v=1.0.10','app.js cache busting');
has(html,'css/app.css?v=1.0.10','css cache busting');

console.log(`PASS: ${passed} assertions`);
console.log(`Sample theoretical Cu addition = ${x.toFixed(9)} g`);
