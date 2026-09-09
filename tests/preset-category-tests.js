'use strict';
const assert=require('assert');
const P=require('../js/preset-categories-v1.6.js');

let passed=0;
function ok(v,msg){assert.ok(v,msg);passed++}
function eq(a,b,msg){assert.strictEqual(a,b,msg);passed++}

['025C','03C','05C','1C','2C','4C','8C'].forEach(n=>eq(P.FIVE_N_GROUPS[n],'al-cu',`${n} -> Al-Cu`));
['03S','05S','08S','1S','1.2S','30ppmS'].forEach(n=>eq(P.FIVE_N_GROUPS[n],'al-si',`${n} -> Al-Si`));
['02S05C','075S05C','08S03C','08S05C','1S004C','1S05C'].forEach(n=>eq(P.FIVE_N_GROUPS[n],'al-si-cu',`${n} -> Al-Si-Cu`));

const groups=new Set(P.JIS_PRESETS.map(x=>x.group));
['1000','2000','3000','4000','5000','6000','7000','8000','casting'].forEach(g=>ok(groups.has(g),`missing JIS group ${g}`));
eq(P.JIS_PRESETS.length,30,'expected 30 JIS presets');

eq(P.midpoint('0.05','0.20'),'0.125','A1100 Cu midpoint');
eq(P.midpoint('3.5','4.5'),'4','A2017 Cu midpoint');
eq(P.midpoint('2.1','2.9'),'2.5','A7075 Mg midpoint');
eq(P.midpoint('6.5','7.5'),'7','AC4CH Si midpoint');
eq(P.midpoint('22','24'),'23','AC9A Si midpoint');

const a7075=P.JIS_PRESETS.find(x=>x.name==='A7075');
assert.deepStrictEqual(a7075.targets.map(x=>[x.element,P.midpoint(x.min,x.max)]),[['Cu','1.6'],['Mg','2.5'],['Cr','0.23'],['Zn','5.6']]);passed++;
const ac4ch=P.JIS_PRESETS.find(x=>x.name==='AC4CH');
assert.deepStrictEqual(ac4ch.targets.map(x=>[x.element,P.midpoint(x.min,x.max)]),[['Si','7'],['Mg','0.35']]);passed++;

const stores={
  appMetadata:new Map(),additives:new Map([
    ['add-5n-cu',{id:'add-5n-cu',name:'Cu',mainElement:'Cu',components:[{element:'Cu',wtPercent:'99.999'}],active:true}],
    ['add-5n-si',{id:'add-5n-si',name:'Si',mainElement:'Si',components:[{element:'Si',wtPercent:'99.999'}],active:true}],
    ['add-5n-ti',{id:'add-5n-ti',name:'Ti',mainElement:'Ti',components:[{element:'Ti',wtPercent:'99.999'}],active:true}]
  ]),
  scales:new Map([['scale-100',{id:'scale-100',resolutionG:'1',active:true}]]),
  productRecipes:new Map([
    ['default-preset-05c',{id:'default-preset-05c',kind:'blendPreset',name:'05C',systemDefault:true,data:{rows:[]}}],
    ['custom',{id:'custom',kind:'blendPreset',name:'MyPreset',data:{rows:[]}}]
  ])
};
const S={
  async get(store,key){return stores[store]?.get(key)},
  async getAll(store){return [...(stores[store]?.values()||[])]},
  async put(store,value){stores[store].set(value.id??value.key,value);return value}
};

(async()=>{
  await P.migratePresetCatalog(S);
  eq(stores.productRecipes.get('default-preset-05c').category,'5n','standard preset category');
  eq(stores.productRecipes.get('default-preset-05c').group,'al-cu','standard preset group');
  eq(P.categoryForRecipe(stores.productRecipes.get('custom')),'user','custom preset remains user');
  ok(stores.additives.has('add-5n-mg'),'Mg default additive seeded');
  ok(stores.additives.has('add-5n-fe'),'Fe default additive seeded');
  ok(stores.productRecipes.has('jis-preset-a7075'),'A7075 preset seeded');
  ok(stores.productRecipes.has('jis-preset-ac4ch'),'AC4CH preset seeded');
  const jis=stores.productRecipes.get('jis-preset-a7075');
  eq(jis.category,'jis','A7075 category');
  eq(jis.group,'7000','A7075 group');
  assert.deepStrictEqual(jis.data.rows.map(r=>[r.element,r.target]),[['Cu','1.6'],['Mg','2.5'],['Cr','0.23'],['Zn','5.6']]);passed++;
  ok(stores.appMetadata.has(P.MIGRATION_KEY),'migration marker');
  const countAfter=stores.productRecipes.size;
  await P.migratePresetCatalog(S);
  eq(stores.productRecipes.size,countAfter,'migration idempotent');
  console.log(`PASS: ${passed} preset-category assertions`);
})().catch(e=>{console.error(e);process.exit(1)});
