'use strict';
const assert=require('assert');
const P=require('../js/preset-categories-v1.6.js');
global.PresetCatalogV16=P;
require('../js/jis-preset-data-v1.6.1.js');

const a8011a=P.JIS_PRESETS.find(x=>x.name==='A8011A');
assert.ok(a8011a,'A8011A preset must exist');
assert.ok(!P.JIS_PRESETS.some(x=>x.name==='A8011'),'A8011 legacy label must not remain');
assert.deepStrictEqual(a8011a.targets.map(x=>[x.element,x.min,x.max,P.midpoint(x.min,x.max)]),[
  ['Si','0.40','0.8','0.6'],
  ['Fe','0.50','1.0','0.75']
]);
console.log('PASS: JIS 8000-series preset data');
