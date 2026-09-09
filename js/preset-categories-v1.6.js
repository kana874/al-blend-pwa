(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else{
    root.PresetCatalogV16=api;
    if(root.AppStorage)api.installStorageMigration(root.AppStorage);
    api.scheduleUi(root);
  }
})(typeof self!=='undefined'?self:this,function(){
'use strict';

const MIGRATION_KEY='migration-1.6.0-preset-categories-jis';
const SELECTION_KEY='alBlendPresetSelectionV16';
const CATEGORY_ORDER=['5n','jis','user'];
const CATEGORY_LABELS={5n:'5N',jis:'JIS合金',user:'ユーザー'};
const GROUP_ORDER={
  '5n':['al-cu','al-si','al-si-cu'],
  jis:['1000','2000','3000','4000','5000','6000','7000','8000','casting'],
  user:['user']
};
const GROUP_LABELS={
  'al-cu':'Al-Cu系','al-si':'Al-Si系','al-si-cu':'Al-Si-Cu系',
  '1000':'1000系','2000':'2000系','3000':'3000系','4000':'4000系','5000':'5000系','6000':'6000系','7000':'7000系','8000':'8000系',casting:'鋳物用',user:'ユーザープリセット'
};

const FIVE_N_GROUPS={
  '025C':'al-cu','03C':'al-cu','05C':'al-cu','1C':'al-cu','2C':'al-cu','4C':'al-cu','8C':'al-cu',
  '03S':'al-si','05S':'al-si','08S':'al-si','1S':'al-si','1.2S':'al-si','30ppmS':'al-si',
  '02S05C':'al-si-cu','075S05C':'al-si-cu','08S03C':'al-si-cu','08S05C':'al-si-cu','1S004C':'al-si-cu','1S05C':'al-si-cu'
};

const ADDITIVE_DEFAULTS=[
  ['Mg','add-5n-mg'],['Mn','add-5n-mn'],['Cr','add-5n-cr'],['Zn','add-5n-zn'],['Ni','add-5n-ni'],['Fe','add-5n-fe']
].map(([element,id])=>({
  id,name:element,type:'pure',mainElement:element,
  components:[{element,wtPercent:'99.999'}],purity:'99.999',maker:'',partNo:'',note:'',active:true
}));

function t(element,min,max){return{element,min:String(min),max:String(max)}}

// JIS ranges used here are the explicit lower-to-upper composition ranges.
// Elements specified only by a maximum ("x%以下") are intentionally not turned into addition targets.
const JIS_PRESETS=[
  {name:'A1100',group:'1000',standard:'JIS H 4000/H 4040/H 4100',targets:[t('Cu','0.05','0.20')]},

  {name:'A2014',group:'2000',standard:'JIS H 4000/H 4040/H 4100',targets:[t('Si','0.50','1.2'),t('Cu','3.9','5.0'),t('Mn','0.40','1.2'),t('Mg','0.20','0.8')]},
  {name:'A2017',group:'2000',standard:'JIS H 4000/H 4040/H 4100',targets:[t('Si','0.20','0.8'),t('Cu','3.5','4.5'),t('Mn','0.40','1.0'),t('Mg','0.40','0.8')]},
  {name:'A2024',group:'2000',standard:'JIS H 4000/H 4040/H 4100',targets:[t('Cu','3.8','4.9'),t('Mn','0.30','0.9'),t('Mg','1.2','1.8')]},

  {name:'A3003',group:'3000',standard:'JIS H 4000/H 4040/H 4100',targets:[t('Cu','0.05','0.20'),t('Mn','1.0','1.5')]},
  {name:'A3004',group:'3000',standard:'JIS H 4000',targets:[t('Mn','1.0','1.5'),t('Mg','0.8','1.3')]},

  {name:'A4032',group:'4000',standard:'JIS H 4000',targets:[t('Si','11.0','13.5'),t('Cu','0.50','1.3'),t('Mg','0.8','1.3'),t('Ni','0.50','1.3')]},

  {name:'A5052',group:'5000',standard:'JIS H 4000/H 4040/H 4100',targets:[t('Mg','2.2','2.8'),t('Cr','0.15','0.35')]},
  {name:'A5083',group:'5000',standard:'JIS H 4000/H 4040/H 4100',targets:[t('Mn','0.40','1.0'),t('Mg','4.0','4.9'),t('Cr','0.05','0.25')]},

  {name:'A6061',group:'6000',standard:'JIS H 4000/H 4040/H 4100',targets:[t('Si','0.40','0.8'),t('Cu','0.15','0.40'),t('Mg','0.8','1.2'),t('Cr','0.04','0.35')]},
  {name:'A6063',group:'6000',standard:'JIS H 4000/H 4040/H 4100',targets:[t('Si','0.20','0.6'),t('Mg','0.45','0.9')]},

  {name:'A7075',group:'7000',standard:'JIS H 4000/H 4040/H 4100',targets:[t('Cu','1.2','2.0'),t('Mg','2.1','2.9'),t('Cr','0.18','0.28'),t('Zn','5.1','6.1')]},

  {name:'A8011',group:'8000',standard:'JIS H 4000',targets:[t('Si','0.50','0.9'),t('Fe','0.6','1.0')]},
  {name:'A8021',group:'8000',standard:'JIS H 4000',targets:[t('Fe','1.2','1.7')]},

  {name:'AC1B',group:'casting',standard:'JIS H 5202:2010',targets:[t('Cu','4.2','5.0'),t('Mg','0.15','0.35'),t('Ti','0.05','0.35')]},
  {name:'AC2A',group:'casting',standard:'JIS H 5202:2010',targets:[t('Cu','3.0','4.5'),t('Si','4.0','6.0')]},
  {name:'AC2B',group:'casting',standard:'JIS H 5202:2010',targets:[t('Cu','2.0','4.0'),t('Si','5.0','7.0')]},
  {name:'AC3A',group:'casting',standard:'JIS H 5202:2010',targets:[t('Si','10.0','13.0')]},
  {name:'AC4A',group:'casting',standard:'JIS H 5202:2010',targets:[t('Si','8.0','10.0'),t('Mg','0.30','0.6'),t('Mn','0.30','0.6')]},
  {name:'AC4B',group:'casting',standard:'JIS H 5202:2010',targets:[t('Cu','2.0','4.0'),t('Si','7.0','10.0')]},
  {name:'AC4C',group:'casting',standard:'JIS H 5202:2010',targets:[t('Si','6.5','7.5'),t('Mg','0.20','0.4')]},
  {name:'AC4CH',group:'casting',standard:'JIS H 5202:2010',targets:[t('Si','6.5','7.5'),t('Mg','0.25','0.45')]},
  {name:'AC4D',group:'casting',standard:'JIS H 5202:2010',targets:[t('Cu','1.0','1.5'),t('Si','4.5','5.5'),t('Mg','0.4','0.6')]},
  {name:'AC5A',group:'casting',standard:'JIS H 5202:2010',targets:[t('Cu','3.5','4.5'),t('Mg','1.2','1.8'),t('Ni','1.7','2.3')]},
  {name:'AC7A',group:'casting',standard:'JIS H 5202:2010',targets:[t('Mg','3.5','5.5')]},
  {name:'AC8A',group:'casting',standard:'JIS H 5202:2010',targets:[t('Cu','0.8','1.3'),t('Si','11.0','13.0'),t('Mg','0.7','1.3'),t('Ni','0.8','1.5')]},
  {name:'AC8B',group:'casting',standard:'JIS H 5202:2010',targets:[t('Cu','2.0','4.0'),t('Si','8.5','10.5'),t('Mg','0.50','1.5'),t('Ni','0.10','1.0')]},
  {name:'AC8C',group:'casting',standard:'JIS H 5202:2010',targets:[t('Cu','2.0','4.0'),t('Si','8.5','10.5'),t('Mg','0.50','1.5')]},
  {name:'AC9A',group:'casting',standard:'JIS H 5202:2010',targets:[t('Cu','0.50','1.5'),t('Si','22','24'),t('Mg','0.50','1.5'),t('Ni','0.50','1.5')]},
  {name:'AC9B',group:'casting',standard:'JIS H 5202:2010',targets:[t('Cu','0.50','1.5'),t('Si','18','20'),t('Mg','0.50','1.5'),t('Ni','0.50','1.5')]}
];

function midpoint(min,max){
  const n=(Number(min)+Number(max))/2;
  if(!Number.isFinite(n))throw new Error(`Invalid range: ${min} - ${max}`);
  return n.toFixed(6).replace(/\.?0+$/,'');
}
function slug(s){return String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
function componentPct(additive,element){
  if(!additive)return'';
  const c=(additive.components||[]).find(x=>String(x.element||'').toLowerCase()===String(element).toLowerCase())||(additive.components||[])[0];
  return c?String(c.wtPercent??''):'';
}
function categoryForRecipe(r){
  if(r?.category==='5n'||r?.category==='jis')return r.category;
  if(r?.systemDefault&&FIVE_N_GROUPS[String(r.name||'')])return'5n';
  return'user';
}
function groupForRecipe(r){
  const category=categoryForRecipe(r);
  if(category==='5n')return r?.group||FIVE_N_GROUPS[String(r?.name||'')]||'al-cu';
  if(category==='jis')return r?.group||'1000';
  return'user';
}

async function migratePresetCatalog(S){
  if(!S||typeof S.get!=='function')return;
  if(await S.get('appMetadata',MIGRATION_KEY))return;

  for(const additive of ADDITIVE_DEFAULTS){
    if(!(await S.get('additives',additive.id)))await S.put('additives',additive);
  }

  const recipes=await S.getAll('productRecipes');
  for(const recipe of recipes){
    const name=String(recipe?.name||'');
    const group=FIVE_N_GROUPS[name];
    if(!group)continue;
    if(recipe.systemDefault===true||String(recipe.id||'').startsWith('default-preset-')){
      if(recipe.category!=='5n'||recipe.group!==group){
        await S.put('productRecipes',{...recipe,category:'5n',group,catalogVersion:1,updatedAt:new Date().toISOString()});
      }
    }
  }

  const additives=await S.getAll('additives');
  const scales=await S.getAll('scales');
  const byElement=new Map();
  for(const a of additives){
    if(a.active===false)continue;
    const key=String(a.mainElement||'').toLowerCase();
    if(!byElement.has(key))byElement.set(key,a);
  }
  const preferredIds={Cu:'add-5n-cu',Si:'add-5n-si',Ti:'add-5n-ti',Mg:'add-5n-mg',Mn:'add-5n-mn',Cr:'add-5n-cr',Zn:'add-5n-zn',Ni:'add-5n-ni',Fe:'add-5n-fe'};
  const additiveFor=element=>additives.find(a=>a.id===preferredIds[element]&&a.active!==false)||byElement.get(String(element).toLowerCase())||null;
  const oneGramScale=scales.find(s=>s.active!==false&&Number(s.resolutionG)===1)||null;

  for(const def of JIS_PRESETS){
    const id=`jis-preset-${slug(def.name)}`;
    if(await S.get('productRecipes',id))continue;
    const rows=def.targets.map(range=>{
      const additive=additiveFor(range.element);
      return{
        element:range.element,current:'',currentUnit:'ppm',target:midpoint(range.min,range.max),targetUnit:'wt%',
        additiveId:additive?.id||'',additivePct:componentPct(additive,range.element),yield:'100',yieldSource:'manual'
      };
    });
    await S.put('productRecipes',{
      id,kind:'blendPreset',name:def.name,category:'jis',group:def.group,systemDefault:true,defaultRevision:1,catalogVersion:1,
      standard:def.standard,targetBasis:'range-midpoint',
      jisRanges:def.targets.map(x=>({...x,target:midpoint(x.min,x.max)})),
      data:{meltUnit:'kg',scaleId:oneGramScale?oneGramScale.id:'',roundingMode:'half-up',rows},
      createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()
    });
  }

  await S.put('appMetadata',{key:MIGRATION_KEY,value:true,at:new Date().toISOString()});
}

function installStorageMigration(S){
  if(!S||S.__presetCatalogV16Installed)return;
  const original=typeof S.migrateAppData==='function'?S.migrateAppData.bind(S):async()=>{};
  S.migrateAppData=async function(){await original();await migratePresetCatalog(S)};
  try{Object.defineProperty(S,'__presetCatalogV16Installed',{value:true,enumerable:false})}catch(_){S.__presetCatalogV16Installed=true}
}

function injectStyles(doc){
  if(doc.getElementById('presetCatalogV16Style'))return;
  const style=doc.createElement('style');style.id='presetCatalogV16Style';
  style.textContent=`
    .preset-controls{align-items:flex-end;flex-wrap:wrap}
    .preset-stage-control{display:flex;flex-direction:column;gap:4px;min-width:180px;flex:1 1 190px}
    .preset-stage-control.preset-stage-main{min-width:230px;flex:2 1 280px}
    .preset-stage-label{font-size:11px;font-weight:750;color:var(--muted);padding-left:2px}
    .preset-stage-control select{width:100%}
    #blendPresetSelect optgroup{font-weight:800}
    #blendPresetSelect option{font-weight:400}
    @media(max-width:760px){.preset-stage-control,.preset-stage-control.preset-stage-main{min-width:100%;flex-basis:100%}.preset-controls>button{flex:1 1 auto}}
  `;
  doc.head.appendChild(style);
}

function injectHelp(doc){
  if(doc.getElementById('h-preset-catalog'))return;
  const article=doc.querySelector('#helpContent article');if(!article)return;
  const anchor=doc.getElementById('h-formulas');
  const box=doc.createElement('div');
  box.innerHTML=`<h2 id="h-preset-catalog">プリセットカテゴリとJIS合金</h2>
  <p>プリセットは「カテゴリ → プリセット」の2段階で選択します。5Nは Al-Cu系 / Al-Si系 / Al-Si-Cu系、JIS合金は1000～8000系と鋳物用に分けています。最後に選択したカテゴリとプリセットは端末に保存し、次回起動時に復元します。</p>
  <p><strong>JIS合金プリセットの目標値:</strong> 化学成分で下限値と上限値の両方が規定されている元素について、算術中央値 <code>(下限 + 上限) / 2</code> を配合目標に使用します。「○%以下」のように上限だけが規定される元素は添加目標には含めません。</p>
  <p>JISプリセットは配合開始時の目安であり、規格適合を保証するものではありません。実製造では適用するJISの最新版、製品形態、原料分析値、添加歩留まり、最終分析値を確認してください。展伸材はJIS H 4000 / H 4040 / H 4100系、鋳物用はJIS H 5202の化学成分範囲を基準にしています。</p>`;
  anchor?article.insertBefore(box,anchor):article.appendChild(box);
  const toc=doc.querySelector('#helpContent .help-toc');
  if(toc){const a=doc.createElement('a');a.href='#h-preset-catalog';a.textContent='プリセット / JIS合金';const formulaLink=toc.querySelector('a[href="#h-formulas"]');formulaLink?toc.insertBefore(a,formulaLink):toc.appendChild(a)}
}

function scheduleUi(root){
  if(!root||!root.document)return;
  const start=()=>setTimeout(()=>initUi(root).catch(e=>console.error('preset catalog init failed',e)),0);
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',start,{once:true});else start();
}

async function waitForElement(doc,id,tries=80){
  for(let i=0;i<tries;i++){
    const el=doc.getElementById(id);if(el)return el;
    await new Promise(r=>setTimeout(r,25));
  }
  return null;
}

async function initUi(root){
  const doc=root.document,S=root.AppStorage;if(!doc||!S)return;
  await S.openDB();
  await migratePresetCatalog(S);
  const presetSelect=await waitForElement(doc,'blendPresetSelect');if(!presetSelect)return;
  const controls=presetSelect.closest('.preset-controls');if(!controls)return;
  injectStyles(doc);injectHelp(doc);

  let categorySelect=doc.getElementById('blendPresetCategorySelect');
  if(!categorySelect){
    categorySelect=doc.createElement('select');categorySelect.id='blendPresetCategorySelect';categorySelect.setAttribute('aria-label','プリセットカテゴリ');
    const catWrap=doc.createElement('label');catWrap.className='preset-stage-control';
    const catLabel=doc.createElement('span');catLabel.className='preset-stage-label';catLabel.textContent='1. カテゴリ';
    catWrap.append(catLabel,categorySelect);
    const presetWrap=doc.createElement('label');presetWrap.className='preset-stage-control preset-stage-main';
    const presetLabel=doc.createElement('span');presetLabel.className='preset-stage-label';presetLabel.textContent='2. プリセット';
    controls.insertBefore(catWrap,presetSelect);
    controls.insertBefore(presetWrap,presetSelect);
    presetWrap.append(presetLabel,presetSelect);
  }

  let observer=null;let rendering=false;
  const readSelection=()=>{
    try{return JSON.parse(root.localStorage.getItem(SELECTION_KEY)||'{}')||{}}
    catch(_){return{}}
  };
  const saveSelection=(category,presetId)=>{
    root.localStorage.setItem(SELECTION_KEY,JSON.stringify({category,presetId:presetId||''}));
  };

  async function render(preferredId=''){
    if(rendering)return;rendering=true;
    if(observer)observer.disconnect();
    try{
      const rows=(await S.getAll('productRecipes')).filter(r=>r&&r.kind==='blendPreset');
      const hasUser=rows.some(r=>categoryForRecipe(r)==='user');
      const categories=CATEGORY_ORDER.filter(c=>c!=='user'||hasUser);
      const rememberedSelection=readSelection();
      const domId=preferredId||presetSelect.value||'';
      const domRecipe=rows.find(r=>r.id===domId);
      const remembered=rows.find(r=>r.id===rememberedSelection.presetId);
      let category=domRecipe?categoryForRecipe(domRecipe):(categorySelect.value||rememberedSelection.category||'5n');
      if(!categories.includes(category))category='5n';

      categorySelect.innerHTML=categories.map(c=>`<option value="${c}">${CATEGORY_LABELS[c]}</option>`).join('');
      categorySelect.value=category;

      const candidates=rows.filter(r=>categoryForRecipe(r)===category);
      const order=GROUP_ORDER[category]||[];
      const groups=new Map();
      for(const r of candidates){const g=groupForRecipe(r);if(!groups.has(g))groups.set(g,[]);groups.get(g).push(r)}
      const groupKeys=[...groups.keys()].sort((a,b)=>{
        const ai=order.indexOf(a),bi=order.indexOf(b);return(ai<0?999:ai)-(bi<0?999:bi)||String(a).localeCompare(String(b),'ja');
      });
      presetSelect.innerHTML='<option value="">プリセットを選択</option>';
      for(const g of groupKeys){
        const optgroup=doc.createElement('optgroup');optgroup.label=GROUP_LABELS[g]||g;
        groups.get(g).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'ja',{numeric:true})).forEach(r=>{
          const option=doc.createElement('option');option.value=r.id;option.textContent=r.name;optgroup.appendChild(option);
        });
        presetSelect.appendChild(optgroup);
      }

      let selected='';
      if(domRecipe&&categoryForRecipe(domRecipe)===category)selected=domRecipe.id;
      else if(remembered&&categoryForRecipe(remembered)===category)selected=remembered.id;
      if(selected&&[...presetSelect.options].some(o=>o.value===selected))presetSelect.value=selected;
      else presetSelect.value='';
      saveSelection(category,presetSelect.value);
    }finally{
      rendering=false;
      if(observer)observer.observe(presetSelect,{childList:true,subtree:true});
    }
  }

  categorySelect.addEventListener('change',()=>{saveSelection(categorySelect.value,'');render('')});
  presetSelect.addEventListener('change',()=>saveSelection(categorySelect.value,presetSelect.value));

  observer=new MutationObserver(()=>{
    if(rendering)return;
    const selected=presetSelect.value;
    setTimeout(()=>render(selected),0);
  });
  observer.observe(presetSelect,{childList:true,subtree:true});

  await render('');
  setTimeout(()=>render(presetSelect.value),250);
}

return{
  MIGRATION_KEY,SELECTION_KEY,CATEGORY_ORDER,CATEGORY_LABELS,GROUP_ORDER,GROUP_LABELS,FIVE_N_GROUPS,ADDITIVE_DEFAULTS,JIS_PRESETS,
  midpoint,categoryForRecipe,groupForRecipe,migratePresetCatalog,installStorageMigration,scheduleUi
};
});
