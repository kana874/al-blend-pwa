(function(){
'use strict';
const E=window.CalcEngine, D=E.Decimal, S=window.AppStorage, X=window.AppExport;
const state={additives:[],scales:[],settings:null,lastBlend:null,lastVerify:null,lastYield:null,lastDilution:null,editingScaleId:null,editingAdditiveId:null};
const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
const byId=id=>document.getElementById(id);
const HELP={
  meltMass:'配合開始時点のAl溶湯重量です。g / kg / tから選択できます。',
  scale:'推奨秤量値の量子化に使用する天秤分解能です。内部の理論値は丸めません。',
  yield:'添加した目的元素のうち、計算上溶湯中に有効残留した割合です。',
  additive:'添加材中の目的元素含有率をwt%で指定します。純元素は使用材の分析値・保証値を、Al-5TiならTi 5.000などを入力します。'
};
function toast(msg){const t=byId('toast');t.textContent=msg;t.classList.remove('hidden');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.add('hidden'),2600)}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function today(){return new Date().toISOString().slice(0,10)}
function selectedYieldMap(){try{return JSON.parse(localStorage.getItem('alBlendSelectedYield')||'{}')}catch{return {}}}
function setSelectedYield(key,obj){const m=selectedYieldMap();m[key]=obj;localStorage.setItem('alBlendSelectedYield',JSON.stringify(m))}
function additivePct(additive,element){if(!additive)return'';const c=(additive.components||[]).find(x=>String(x.element).toLowerCase()===String(element).toLowerCase())||(additive.components||[])[0];return c?c.wtPercent:''}
function availableElements(){const m=new Map();for(const a of state.additives){const el=String(a.mainElement||'').trim();if(el&&!m.has(el.toLowerCase()))m.set(el.toLowerCase(),el)}return [...m.values()].sort((a,b)=>a.localeCompare(b,'ja',{sensitivity:'base'}))}
function elementOptions(selected='',includeAll=false){
  const elems=availableElements();
  if(includeAll){
    const lead='<option value="">全元素</option>';
    if(!elems.length)return lead;
    return lead+elems.map(x=>`<option value="${esc(x)}" ${x===selected?'selected':''}>${esc(x)}</option>`).join('');
  }
  if(!elems.length)return '<option value="" selected disabled>添加材マスタに主元素を登録してください</option>';
  const valid=elems.includes(selected);const lead=`<option value="" disabled ${valid?'':'selected'}>元素を選択</option>`;
  return lead+elems.map(x=>`<option value="${esc(x)}" ${x===selected?'selected':''}>${esc(x)}</option>`).join('');
}
function scaleUnit(scale){return scale&&scale.resolutionUnit==='kg'?'kg':'g'}
function scaleResolutionValue(scale){if(scale?.resolutionValue)return D.from(scale.resolutionValue);return E.gramToMass(scale?.resolutionG||'0',scaleUnit(scale))}
function scaleResolutionText(scale){return `${scaleResolutionValue(scale).toString()} ${scaleUnit(scale)}`}
function getDecimals(){return state.settings.decimals}
function fmtD(v,dp){return D.from(v).toFixed(dp)}
function fmtMass(g,mode='addition'){
  const o=E.gramToDisplayMass(g,'auto'); const dp=mode==='melt'?getDecimals().melt:getDecimals().addition; return `${o.value.toFixed(dp)} ${o.unit}`;
}
function decimalPlacesForStep(step){
  const s=D.from(step).abs().toString();
  return s.includes('.')?s.split('.')[1].length:0;
}
function fmtMassByScale(g,resolutionG,unit='auto'){
  const o=E.gramToDisplayMass(g,unit);
  const step=E.gramToMass(resolutionG,o.unit);
  return `${o.value.toFixed(decimalPlacesForStep(step))} ${o.unit}`;
}
function fmtMassInUnit(g,unit,dp=getDecimals().melt){return `${E.gramToMass(g,unit).toFixed(dp)} ${unit}`}
function calcNum(v,sig=12){
  const n=Number(D.from(v).toString());
  if(!Number.isFinite(n))return D.from(v).toString();
  if(n===0)return '0';
  const a=Math.abs(n);
  if(a>=1e9||a<1e-8)return n.toExponential(Math.min(sig-1,10)).replace(/\.0+e/,'e').replace(/(\.\d*?[1-9])0+e/,'$1e');
  const digits=Math.max(0,Math.min(12,sig-1-Math.floor(Math.log10(a))));
  return n.toFixed(digits).replace(/\.?0+$/,'');
}
function calcMassG(v){return `${calcNum(v,11)} g`}
function formulaMassInUnit(g,unit){return `${calcNum(E.gramToMass(g,unit),12)} ${unit}`}
function formulaConc(frac,unit,sig=11){return `${calcNum(E.fractionToConcentration(frac,unit),sig)} ${unit}`}
function formulaYield(frac){return `${calcNum(D.from(frac).mul(100),9)} %`}

function roundingLabel(mode){return mode==='ceil'?'切り上げ':mode==='floor'?'切り捨て':'四捨五入'}
function fmtConc(frac,unit){const dp=unit==='ppm'?getDecimals().ppm:unit==='ppb'?getDecimals().ppb:getDecimals().wt;return `${E.fractionToConcentration(frac,unit).toFixed(dp)} ${unit}`}
function fmtYield(frac){return `${D.from(frac).mul(100).toFixed(getDecimals().yield)} %`}
function parsePositiveText(el,name){const v=String(el.value).trim();if(!v)throw new Error(`${name}を入力してください。`);return v}
function setMessage(el,msg,type='muted'){el.className=`message ${type}`;el.textContent=msg}
function resultError(el,e){el.innerHTML=`<div class="message error">${esc(e.message||e)}</div>`}

async function refreshMasters(){
  state.additives=(await S.getAll('additives')).filter(x=>x.active!==false).sort((a,b)=>a.name.localeCompare(b.name,'ja'));
  state.scales=(await S.getAll('scales')).filter(x=>x.active!==false).sort((a,b)=>Number(a.resolutionG)-Number(b.resolutionG));
  fillElementSelects(); renderScaleSelects(); renderAllAdditiveSelects(); renderMasterTables(); await renderPresetOptions();
}
function renderScaleSelects(){
  const sel=byId('blendScale'); const prev=sel.value; sel.innerHTML=state.scales.map(s=>`<option value="${esc(s.id)}">${esc(s.name)} (${esc(scaleResolutionText(s))})</option>`).join('');
  if(state.scales.some(s=>s.id===prev))sel.value=prev;
}
function additiveOptions(element='',selected=''){
  const arr=element?state.additives.filter(a=>String(a.mainElement).toLowerCase()===String(element).toLowerCase()):state.additives;
  return `<option value="">選択</option>`+arr.map(a=>`<option value="${esc(a.id)}" ${a.id===selected?'selected':''}>${esc(a.name)}</option>`).join('');
}
function renderAllAdditiveSelects(){
  ['verifyAdditive','yieldAdditive'].forEach(id=>{const sel=byId(id);const p=sel.value;const elem=byId(id==='verifyAdditive'?'verifyElement':'yieldElement').value;sel.innerHTML=additiveOptions(elem,p);if(state.additives.some(a=>a.id===p))sel.value=p;});
  $$('.element-card').forEach(card=>updateRowAdditives(card));
}
function fillElementSelects(){
  ['verifyElement','yieldElement','yieldFilterElement'].forEach(id=>{const s=byId(id);if(!s)return;const cur=s.value;s.innerHTML=elementOptions(cur,id==='yieldFilterElement');if(cur&&availableElements().includes(cur))s.value=cur;});
  $$('.element-card').forEach(card=>{const sel=card.querySelector('.row-element');const cur=sel.value;sel.innerHTML=elementOptions(cur);if(cur&&availableElements().includes(cur))sel.value=cur;});
}
function additiveChanged(sel,pctId,element){const a=state.additives.find(x=>x.id===sel.value);if(a)byId(pctId).value=additivePct(a,element||a.mainElement)}

async function getBlendPresets(){
  return (await S.getAll('productRecipes')).filter(x=>x.kind==='blendPreset').sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'ja'));
}
async function renderPresetOptions(){
  const sel=byId('blendPresetSelect'); if(!sel)return;
  const cur=sel.value; const rows=await getBlendPresets();
  sel.innerHTML='<option value="">プリセットを選択</option>'+rows.map(r=>`<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('');
  if(rows.some(r=>r.id===cur))sel.value=cur;
}
function captureBlendPresetData(){
  const rows=$$('.element-card').map(card=>({
    element:card.querySelector('.row-element').value,
    currentUnit:card.querySelector('.row-current-unit').value,
    target:card.querySelector('.row-target').value.trim(),
    targetUnit:card.querySelector('.row-target-unit').value,
    additiveId:card.querySelector('.row-additive').value,
    additivePct:card.querySelector('.row-additive-pct').value.trim(),
    yield:card.querySelector('.row-yield').value.trim(),
    yieldSource:card.querySelector('.row-yield-source').value
  }));
  if(!rows.length)throw new Error('元素条件がありません。');
  for(const r of rows){
    if(!r.element)throw new Error('元素を選択してください。');
    if(!r.target)throw new Error(`${r.element}: 目標濃度を入力してからプリセット保存してください。`);
    if(!r.additiveId)throw new Error(`${r.element}: 添加材を選択してください。`);
    if(!r.additivePct)throw new Error(`${r.element}: 添加材含有率を入力してください。`);
    if(!r.yield)throw new Error(`${r.element}: 歩留まりを入力してください。`);
  }
  return {
    meltUnit:byId('blendMeltUnit').value,
    scaleId:byId('blendScale').value,
    roundingMode:byId('blendRounding').value,
    rows
  };
}
async function saveBlendPreset(){
  const name=byId('blendPresetName').value.trim(); if(!name){toast('プリセット名を入力してください。');return;}
  try{
    const data=captureBlendPresetData(); const rows=await getBlendPresets();
    const same=rows.find(r=>String(r.name).toLowerCase()===name.toLowerCase());
    let id=same?.id||S.uid('preset');
    if(same&&!confirm(`「${name}」を上書きしますか？`))return;
    await S.put('productRecipes',{id,kind:'blendPreset',name,data,updatedAt:new Date().toISOString(),createdAt:same?.createdAt||new Date().toISOString()});
    byId('blendPresetName').value=''; await renderPresetOptions(); byId('blendPresetSelect').value=id; toast('プリセットを保存しました。');
  }catch(e){toast(e.message||String(e))}
}
async function applyBlendPreset(){
  const id=byId('blendPresetSelect').value;if(!id){toast('プリセットを選択してください。');return;}
  const preset=await S.get('productRecipes',id);if(!preset||preset.kind!=='blendPreset'){toast('プリセットが見つかりません。');return;}
  const d=preset.data||{};
  byId('blendMeltMass').value='';
  if(d.meltUnit)byId('blendMeltUnit').value=d.meltUnit;
  if(d.scaleId&&state.scales.some(x=>x.id===d.scaleId))byId('blendScale').value=d.scaleId;
  if(d.roundingMode)byId('blendRounding').value=d.roundingMode;
  byId('blendRows').innerHTML='';rowSeq=0;
  const missingElements=[...new Set((d.rows||[]).map(r=>String(r.element||'').trim()).filter(el=>el&&!availableElements().includes(el)))];
  (d.rows||[]).forEach(r=>addBlendRow({...r,current:''}));
  if(!(d.rows||[]).length)addBlendRow({element:availableElements()[0]||''});
  byId('blendTotalAddition').textContent='—';byId('blendFinalMass').textContent='—';
  byId('blendElementSummary').innerHTML='';
  byId('blendDetailPanel').classList.add('hidden');setMessage(byId('blendGlobalMessage'),'溶湯量と現在濃度を入力して計算してください。','muted');
  if(missingElements.length)toast(`プリセットを読み込みました。マスタにない元素（${missingElements.join(' / ')}）は再選択してください。`);else toast(`プリセット「${preset.name}」を読み込みました。`);
}
async function deleteBlendPreset(){
  const id=byId('blendPresetSelect').value;if(!id){toast('プリセットを選択してください。');return;}
  const p=await S.get('productRecipes',id);if(!p)return;
  if(!confirm(`プリセット「${p.name}」を削除しますか？`))return;
  await S.remove('productRecipes',id);await renderPresetOptions();toast('プリセットを削除しました。');
}

function showScreen(name){
  $$('.screen').forEach(s=>s.classList.toggle('active',s.id===`screen-${name}`));
  $$('.nav-btn[data-screen]').forEach(b=>b.classList.toggle('active',b.dataset.screen===name));
  state.settings.lastScreen=name;S.saveSettings(state.settings);window.scrollTo({top:0,behavior:'smooth'});
  if(name==='yield')loadYieldRecords(); if(name==='data'){renderMasterTables();loadHistory();}
}
function bindNavigation(){ $$('.nav-btn[data-screen]').forEach(b=>b.addEventListener('click',()=>showScreen(b.dataset.screen))); }

let rowSeq=0;
function addBlendRow(preset={}){
  const id=`row-${++rowSeq}`;const div=document.createElement('div');div.className='element-card';div.dataset.rowId=id;
  const requestedElement=String(preset.element||'').trim();
  const selectedElement=availableElements().includes(requestedElement)?requestedElement:(requestedElement?'':(availableElements()[0]||''));
  div.innerHTML=`
    <div class="element-header"><div class="element-title"><span class="element-index">${rowSeq}</span><strong>元素条件</strong></div><button class="ghost remove-row" type="button">削除</button></div>
    <div class="element-grid">
      <label class="element-select-field">元素<select class="row-element row-element-select" aria-label="元素" required>${elementOptions(selectedElement)}</select></label>
      <label>現在濃度<div class="input-with-unit"><input class="row-current" inputmode="decimal" value="${esc(preset.current??'')}"/><select class="row-current-unit"><option ${preset.currentUnit==='wt%'?'selected':''}>wt%</option><option ${!preset.currentUnit||preset.currentUnit==='ppm'?'selected':''}>ppm</option><option ${preset.currentUnit==='ppb'?'selected':''}>ppb</option></select></div></label>
      <label>目標濃度<div class="input-with-unit"><input class="row-target" inputmode="decimal" value="${esc(preset.target??'')}"/><select class="row-target-unit"><option ${preset.targetUnit==='wt%'?'selected':''}>wt%</option><option ${!preset.targetUnit||preset.targetUnit==='ppm'?'selected':''}>ppm</option><option ${preset.targetUnit==='ppb'?'selected':''}>ppb</option></select></div></label>
      <label class="wide">添加材 <button class="help-dot" data-help="additive">?</button><select class="row-additive"></select></label>
      <label>含有率 wt%<input class="row-additive-pct" inputmode="decimal" value="${esc(preset.additivePct??'')}"></label>
      <label>歩留まり % <button class="help-dot" data-help="yield">?</button><input class="row-yield" inputmode="decimal" value="${esc(preset.yield??'100')}"></label>
      <label class="wide">歩留まり入力元<select class="row-yield-source"><option value="manual">手動</option><option value="record">選択実績</option><option value="stat">実績統計(平均)</option></select></label>
    </div>
    <div class="row-result hidden"></div>`;
  byId('blendRows').appendChild(div);
  updateRowAdditives(div,preset.additiveId);
  if(preset.yieldSource)div.querySelector('.row-yield-source').value=preset.yieldSource;
  div.querySelector('.remove-row').addEventListener('click',()=>{if($$('.element-card').length>1)div.remove();else toast('最低1元素は必要です。')});
  div.querySelector('.row-element').addEventListener('change',()=>{div.querySelector('.row-additive-pct').value='';updateRowAdditives(div)});
  div.querySelector('.row-additive').addEventListener('change',()=>{
    const a=state.additives.find(x=>x.id===div.querySelector('.row-additive').value);if(a)div.querySelector('.row-additive-pct').value=additivePct(a,div.querySelector('.row-element').value);
  });
  div.querySelector('.row-yield-source').addEventListener('change',()=>resolveYieldForCard(div,true));
  return div;
}
function updateRowAdditives(card,selected){
  const e=card.querySelector('.row-element').value;const sel=card.querySelector('.row-additive');const prev=selected||sel.value;sel.innerHTML=additiveOptions(e,prev);if(prev&&state.additives.some(a=>a.id===prev))sel.value=prev;
  const a=state.additives.find(x=>x.id===sel.value);if(a&&!card.querySelector('.row-additive-pct').value)card.querySelector('.row-additive-pct').value=additivePct(a,e);
}
async function resolveYieldForCard(card,notify=false){
  const source=card.querySelector('.row-yield-source').value; if(source==='manual')return card.querySelector('.row-yield').value;
  const element=card.querySelector('.row-element').value.trim(); const additiveId=card.querySelector('.row-additive').value; const key=`${element}|${additiveId}`;
  if(source==='record'){
    const r=selectedYieldMap()[key];if(!r)throw new Error(`${element}: 選択実績がありません。歩留まり画面で「配合に使用」を選んでください。`);
    card.querySelector('.row-yield').value=D.from(r.yieldFraction).mul(100).toString(); if(notify)toast('選択実績の歩留まりを反映しました。');return card.querySelector('.row-yield').value;
  }
  const records=(await S.getAll('yieldRecords')).filter(r=>r.adopted!==false&&r.element===element&&(!additiveId||r.additiveId===additiveId));
  if(!records.length)throw new Error(`${element}: 統計に利用できる歩留まり実績がありません。`);
  const avg=records.reduce((s,r)=>s+Number(r.yieldFraction),0)/records.length;card.querySelector('.row-yield').value=String(avg*100);if(notify)toast(`${records.length}件の平均歩留まりを反映しました。`);return card.querySelector('.row-yield').value;
}
async function collectBlendRows(){
  const cards=$$('.element-card');const rows=[];
  for(const card of cards){
    await resolveYieldForCard(card,false);
    const element=card.querySelector('.row-element').value.trim();if(!element||!availableElements().includes(element))throw new Error('元素は添加材マスタの主元素からドロップダウンで選択してください。');
    const current=E.concentrationToFraction(parsePositiveText(card.querySelector('.row-current'),`${element} 現在濃度`),card.querySelector('.row-current-unit').value);
    const target=E.concentrationToFraction(parsePositiveText(card.querySelector('.row-target'),`${element} 目標濃度`),card.querySelector('.row-target-unit').value);
    const pct=parsePositiveText(card.querySelector('.row-additive-pct'),`${element} 添加材含有率`);if(D.from(pct).gt(100))throw new Error(`${element}: 添加材含有率は100%以下にしてください。`);
    const y=parsePositiveText(card.querySelector('.row-yield'),`${element} 歩留まり`);if(D.from(y).lte(0))throw new Error(`${element}: 歩留まりは0%より大きくしてください。`);if(D.from(y).gt(100))toast(`${element}: 歩留まり100%超で計算しています。`);
    const aid=card.querySelector('.row-additive').value;const ad=state.additives.find(a=>a.id===aid);
    rows.push({element,currentFraction:current,targetFraction:target,additiveFraction:E.percentToFraction(pct),yieldFraction:E.percentToFraction(y),additiveId:aid,additiveName:ad?.name||'手入力',yieldSource:card.querySelector('.row-yield-source').value,currentUnit:card.querySelector('.row-current-unit').value,targetUnit:card.querySelector('.row-target-unit').value,card});
  }
  return rows;
}
function renderBlendElementSummary(rows,preferred,res,scale){
  const elementSummary=byId('blendElementSummary');
  if(!elementSummary)return;
  const list=Array.isArray(rows)?rows:[];
  const masses=Array.isArray(preferred)?preferred:[];
  if(list.length<2){
    elementSummary.innerHTML='';
    return;
  }
  const items=list.map((r,i)=>{
    const mass=masses[i];
    const label=String(r?.element||`元素${i+1}`);
    const value=mass==null?'—':fmtMassByScale(mass,res,scaleUnit(scale));
    return `<div class="summary-element-item"><span>${esc(label)} 添加量</span><strong>${esc(value)}</strong></div>`;
  }).join('');
  elementSummary.innerHTML=`<strong>元素別添加量</strong><div class="summary-element-grid">${items}</div>`;
}
async function calcBlend(){
  const msg=byId('blendGlobalMessage');
  try{
    const M=E.massToGram(parsePositiveText(byId('blendMeltMass'),'溶湯量'),byId('blendMeltUnit').value);if(M.lte(0))throw new Error('溶湯量は0より大きくしてください。');
    const rows=await collectBlendRows();const batch=E.calculateMultiElementBatch({meltMassG:M,rows});
    const scale=state.scales.find(s=>s.id===byId('blendScale').value);if(!scale)throw new Error('天秤を設定してください。');const res=D.from(scale.resolutionG);const mode=byId('blendRounding').value;
    const preferred=batch.rows.map(r=>r.theoreticalMassG.quantize(res,mode));
    const recommendedFinal=E.finalConcentrationsForBatch({meltMassG:M,rows:batch.rows,additionMassesG:preferred});
    const totalPreferred=preferred.reduce((s,x)=>s.add(x),D.zero());const finalMass=M.add(totalPreferred);
    byId('blendTotalAddition').textContent=fmtMassByScale(totalPreferred,res,scaleUnit(scale));
    byId('blendFinalMass').textContent=fmtMassByScale(finalMass,res,byId('blendMeltUnit').value);
    renderBlendElementSummary(rows,preferred,res,scale);
    batch.rows.forEach((r,i)=>{
      const card=r.card;const unit=r.targetUnit;const candidates=[['下側',r.theoreticalMassG.quantize(res,'floor')],['四捨五入',r.theoreticalMassG.quantize(res,'half-up')],['上側',r.theoreticalMassG.quantize(res,'ceil')]];
      const unique=[];const seen=new Set();for(const [name,mass] of candidates){if(seen.has(mass.toString()))continue;seen.add(mass.toString());const ms=preferred.slice();ms[i]=mass;const fin=E.finalConcentrationsForBatch({meltMassG:M,rows:batch.rows,additionMassesG:ms})[i];unique.push({name,mass,fin});}
      const out=card.querySelector('.row-result');out.classList.remove('hidden');out.innerHTML=`
        <div><span>理論必要添加量</span><strong>${fmtMass(r.theoreticalMassG)}</strong></div>
        <div><span>推奨秤量値</span><strong>${fmtMassByScale(preferred[i],res,scaleUnit(scale))}</strong></div>
        <div><span>推奨時の予想濃度</span><strong>${fmtConc(recommendedFinal[i],unit)}</strong></div>
        <div><span>目標との差</span><strong>${fmtConc(recommendedFinal[i].sub(r.Ct),unit)}</strong></div>
        <div class="scenario-list" style="grid-column:1/-1"><strong>秤量候補</strong>${unique.map(u=>`<div class="${u.mass.eq(preferred[i])?'preferred':''}"><span>${u.name}: ${fmtMassByScale(u.mass,res,scaleUnit(scale))}</span><span>${fmtConc(u.fin,unit)}</span></div>`).join('')}</div>`;
    });
    state.lastBlend={M,rows:batch.rows,preferred,recommendedFinal,totalPreferred,finalMass,theoreticalTotalAddition:batch.totalAdditionG,scale,mode,at:new Date().toISOString()};
    byId('saveBlendHistory').disabled=true;
    setMessage(msg,'計算完了','success');
    renderBlendDetail();
    try{
      await saveBlendHistory(true);
    }catch(historyError){
      console.error('計算履歴の自動保存に失敗しました。',historyError);
      toast('計算は完了しましたが、履歴の自動保存に失敗しました。');
    }
  }catch(e){
    state.lastBlend=null;byId('saveBlendHistory').disabled=true;
    byId('blendElementSummary').innerHTML='';
    setMessage(msg,e.message,'error');
  }
}
function renderBlendDetail(){
  const r=state.lastBlend;if(!r)return;
  const p=byId('blendDetailPanel');p.classList.remove('hidden');
  const disclosure=byId('blendDetailDisclosure');if(disclosure)disclosure.open=false;
  const res=D.from(r.scale.resolutionG);const roundedTotal=r.totalPreferred;
  const meltUnit=byId('blendMeltUnit').value;
  const multiSymbols=r.rows.length>1?`
      <div><strong>S</strong><span>全元素の総添加量（Σx）</span></div>
      <div><strong>aᵢ</strong><span>元素 i の濃度差から求める中間質量項</span></div>
      <div><strong>bᵢ</strong><span>元素 i の総重量増加補正係数</span></div>
      <div><strong>Σ</strong><span>全元素について合計する記号</span></div>
      <div><strong>i, j</strong><span>各元素を区別する添字</span></div>`:'';
  const symbols=`
    <div class="formula-symbol-grid">
      <div><strong>M</strong><span>添加前の溶湯質量</span></div>
      <div><strong>C₀</strong><span>添加前の目的元素濃度</span></div>
      <div><strong>Cₜ</strong><span>目標濃度</span></div>
      <div><strong>P</strong><span>添加材中の目的元素質量分率</span></div>
      <div><strong>Y</strong><span>添加歩留まり（1 = 100%）</span></div>
      <div><strong>x</strong><span>必要な添加材質量</span></div>
      <div><strong>C₁</strong><span>推奨秤量後の予想濃度</span></div>
      ${multiSymbols}
    </div>`;

  let body='';
  if(r.rows.length===1){
    const x=r.rows[0], rounded=r.preferred[0], fin=r.recommendedFinal[0], unit=x.targetUnit;
    const c0=calcNum(x.C0,10), ct=calcNum(x.Ct,10), pp=calcNum(x.P,10), yy=calcNum(x.Y,10);
    const theoretical=calcNum(x.theoreticalMassG,12), roundedStr=calcNum(rounded,12), finFrac=calcNum(fin,10);
    body=`
      <div class="formula-step"><div class="formula-step-title"><span>1</span>入力値を質量分率へ変換</div>
        <div class="formula-input-grid">
          <div><span>溶湯量 M</span><strong>${esc(formulaMassInUnit(r.M,meltUnit))}</strong><small>= ${esc(calcMassG(r.M))}</small></div>
          <div><span>現在濃度 C₀</span><strong>${esc(formulaConc(x.C0,x.currentUnit))}</strong><small>= ${esc(c0)}（質量分率）</small></div>
          <div><span>目標濃度 Cₜ</span><strong>${esc(formulaConc(x.Ct,x.targetUnit))}</strong><small>= ${esc(ct)}（質量分率）</small></div>
          <div><span>添加材含有率 P</span><strong>${esc(calcNum(D.from(x.P).mul(100),9))} wt%</strong><small>= ${esc(pp)}</small></div>
          <div><span>歩留まり Y</span><strong>${esc(formulaYield(x.Y))}</strong><small>= ${esc(yy)}</small></div>
        </div>
      </div>
      <div class="formula-step"><div class="formula-step-title"><span>2</span>理論必要添加量を計算</div>
        <div class="formula-math"><div class="formula-line formula-main">x = M × (Cₜ − C₀) ÷ (P × Y − Cₜ)</div>
        <div class="formula-line">= ${esc(calcNum(r.M,12))} × (${esc(ct)} − ${esc(c0)}) ÷ (${esc(pp)} × ${esc(yy)} − ${esc(ct)})</div>
        <div class="formula-answer">= ${esc(theoretical)} g</div></div>
      </div>
      <div class="formula-step"><div class="formula-step-title"><span>3</span>天秤分解能で${esc(roundingLabel(r.mode))}</div>
        <div class="formula-math"><div class="formula-line">理論値 ${esc(theoretical)} g → ${esc(scaleResolutionText(r.scale))} 単位で${esc(roundingLabel(r.mode))}</div>
        <div class="formula-answer">推奨秤量値 = ${esc(fmtMassByScale(rounded,res,scaleUnit(r.scale)))}</div></div>
      </div>
      <div class="formula-step"><div class="formula-step-title"><span>4</span>推奨秤量値から最終濃度を再計算</div>
        <div class="formula-math"><div class="formula-line formula-main">C₁ = (M × C₀ + x × P × Y) ÷ (M + x)</div>
        <div class="formula-line">= (${esc(calcNum(r.M,12))} × ${esc(c0)} + ${esc(roundedStr)} × ${esc(pp)} × ${esc(yy)}) ÷ (${esc(calcNum(r.M,12))} + ${esc(roundedStr)})</div>
        <div class="formula-answer">= ${esc(formulaConc(fin,unit,12))}</div></div>
        <div class="formula-final-grid"><div><span>添加後総重量</span><strong>${esc(fmtMassByScale(r.finalMass,res,meltUnit))}</strong></div><div><span>内部質量分率 C₁</span><strong>${esc(finFrac)}</strong></div></div>
      </div>`;
  }else{
    const sumA=r.rows.reduce((sum,x)=>sum.add(x.a),D.zero());
    const sumB=r.rows.reduce((sum,x)=>sum.add(x.b),D.zero());
    const rowSteps=r.rows.map((x,i)=>{
      const rounded=r.preferred[i], fin=r.recommendedFinal[i];
      return `<div class="formula-multi-row"><h4>${esc(x.element)}</h4>
        <div><span>aᵢ</span><strong>${esc(calcNum(x.a,11))} g</strong></div>
        <div><span>bᵢ</span><strong>${esc(calcNum(x.b,11))}</strong></div>
        <div><span>理論 xᵢ</span><strong>${esc(calcNum(x.theoreticalMassG,11))} g</strong></div>
        <div><span>推奨秤量</span><strong>${esc(fmtMassByScale(rounded,res,scaleUnit(r.scale)))}</strong></div>
        <div><span>予想濃度 C₁</span><strong>${esc(fmtConc(fin,x.targetUnit))}</strong></div>
      </div>`;
    }).join('');
    body=`
      <div class="formula-step"><div class="formula-step-title"><span>1</span>複数元素の共通総重量を考慮</div>
        <p class="formula-note formula-note-top">複数元素では、各添加材が最終総重量を増やすため、元素ごとに完全独立では計算せず、総添加量 S を共通項として連立します。</p>
        <div class="formula-math"><div class="formula-line formula-main">Cₜᵢ = (M·C₀ᵢ + xᵢ·Pᵢ·Yᵢ) ÷ (M + Σxⱼ)</div>
        <div class="formula-line">aᵢ = M·(Cₜᵢ − C₀ᵢ) ÷ (Pᵢ·Yᵢ)</div>
        <div class="formula-line">bᵢ = Cₜᵢ ÷ (Pᵢ·Yᵢ)</div>
        <div class="formula-line">S = Σaᵢ ÷ (1 − Σbᵢ)</div>
        <div class="formula-line">xᵢ = aᵢ + bᵢ·S</div></div>
      </div>
      <div class="formula-step"><div class="formula-step-title"><span>2</span>共通総添加量 S を算出</div>
        <div class="formula-math"><div class="formula-line">Σa = ${esc(calcNum(sumA,12))} g</div><div class="formula-line">Σb = ${esc(calcNum(sumB,12))}</div><div class="formula-answer">S = ${esc(calcNum(r.theoreticalTotalAddition,12))} g</div></div>
      </div>
      <div class="formula-step"><div class="formula-step-title"><span>3</span>元素ごとの添加量と推奨秤量値</div><div class="formula-multi-grid">${rowSteps}</div></div>
      <div class="formula-step"><div class="formula-step-title"><span>4</span>推奨秤量後の総重量</div><div class="formula-final-grid"><div><span>総添加量</span><strong>${esc(fmtMassByScale(roundedTotal,res,scaleUnit(r.scale)))}</strong></div><div><span>添加後総重量</span><strong>${esc(fmtMassByScale(r.finalMass,res,meltUnit))}</strong></div></div></div>`;
  }
  byId('blendDetail').innerHTML=`<div class="formula-intro"><strong>標準モデルA</strong><span>添加材全量を最終総重量へ加算し、目的元素として有効になる量だけに歩留まりを反映します。</span></div><div class="formula-legend"><h3>記号の意味</h3>${symbols}</div>${body}<div class="formula-note">※ 濃度は内部では質量分率に変換して計算し、中間値は丸めません。表示と秤量値だけを指定条件に従って丸めています。</div>`;
}
async function persistCalculationHistory(record){
  await S.put('calculationHistory',record);
  await loadHistory();
  return record;
}
function buildBlendHistoryRecord(r){
  return {
    id:S.uid('calc'),
    date:new Date().toISOString(),
    type:'配合計算',
    summary:r.rows.map((x,i)=>`${x.element} ${fmtMassByScale(r.preferred[i],r.scale.resolutionG,scaleUnit(r.scale))}`).join(' / '),
    payload:{
      meltMassG:r.M.toString(),
      meltUnit:byId('blendMeltUnit').value,
      scaleId:r.scale.id,
      roundingMode:r.mode,
      totalAdditionMassG:r.totalPreferred.toString(),
      finalMassG:r.finalMass.toString(),
      rows:r.rows.map((x,i)=>({
        element:x.element,
        currentFraction:x.C0.toString(),
        targetFraction:x.Ct.toString(),
        currentUnit:x.currentUnit,
        targetUnit:x.targetUnit,
        additiveId:x.additiveId,
        additiveName:x.additiveName,
        yieldFraction:x.Y.toString(),
        theoreticalMassG:x.theoreticalMassG.toString(),
        recommendedMassG:r.preferred[i].toString(),
        finalFraction:r.recommendedFinal[i].toString()
      }))
    }
  };
}
async function saveBlendHistory(silent=false){
  if(!state.lastBlend)return null;
  const record=buildBlendHistoryRecord(state.lastBlend);
  await persistCalculationHistory(record);
  state.lastBlend.historyId=record.id;
  if(!silent)toast('配合計算を履歴に保存しました。');
  return record;
}
function loadBlendSample(){byId('blendMeltMass').value='1900';byId('blendMeltUnit').value='kg';if(state.scales.some(s=>s.id==='scale-100'))byId('blendScale').value='scale-100';byId('blendRounding').value='half-up';byId('blendRows').innerHTML='';rowSeq=0;addBlendRow({element:'Cu',current:'0.1',target:'0.5',currentUnit:'ppm',targetUnit:'wt%',additiveId:'add-5n-cu',additivePct:'99.999',yield:'100'});toast('サンプル値を入力しました。')}

function bindVerify(){
  byId('verifyElement').addEventListener('change',()=>{const s=byId('verifyAdditive');s.innerHTML=additiveOptions(byId('verifyElement').value);if(s.options.length>1){s.selectedIndex=1;additiveChanged(s,'verifyAdditivePct',byId('verifyElement').value)}});
  byId('verifyAdditive').addEventListener('change',()=>additiveChanged(byId('verifyAdditive'),'verifyAdditivePct',byId('verifyElement').value));
  byId('calcVerify').addEventListener('click',async()=>{try{
    const M=E.massToGram(parsePositiveText(byId('verifyMeltMass'),'溶湯量'),byId('verifyMeltUnit').value);
    const C0=E.concentrationToFraction(parsePositiveText(byId('verifyCurrent'),'現在濃度'),byId('verifyCurrentUnit').value);
    const x=E.massToGram(parsePositiveText(byId('verifyAddition'),'実添加量'),byId('verifyAdditionUnit').value);
    const P=E.percentToFraction(parsePositiveText(byId('verifyAdditivePct'),'添加材含有率'));
    const Y=E.percentToFraction(parsePositiveText(byId('verifyYield'),'歩留まり'));
    const C1=E.calculateFinalConcentration({meltMassG:M,currentFraction:C0,additionMassG:x,additiveFraction:P,yieldFraction:Y});
    const unit=byId('verifyOutputUnit').value;let diff='—';let target=null;
    if(byId('verifyTarget').value.trim()){target=E.concentrationToFraction(byId('verifyTarget').value,byId('verifyTargetUnit').value);diff=fmtConc(C1.sub(target),unit)}
    byId('verifyResult').innerHTML=`<div class="result-card"><h3>添加確認結果</h3><div class="result-values"><div><span>推定最終濃度</span><strong>${fmtConc(C1,unit)}</strong></div><div><span>濃度増加量</span><strong>${fmtConc(C1.sub(C0),unit)}</strong></div><div><span>添加後総重量</span><strong>${fmtMassInUnit(M.add(x),byId('verifyMeltUnit').value,getDecimals().melt)}</strong></div>${target?`<div><span>目標との差</span><strong>${diff}</strong></div>`:''}</div></div>`;
    state.lastVerify={M,C0,x,P,Y,C1,target,unit};byId('saveVerifyHistory').disabled=true;
    const element=byId('verifyElement').value,aid=byId('verifyAdditive').value,ad=state.additives.find(a=>a.id===aid);
    await persistCalculationHistory({id:S.uid('calc'),date:new Date().toISOString(),type:'添加確認',summary:`${element}: ${fmtConc(C1,unit)}`,payload:{element,meltMassG:M.toString(),meltUnit:byId('verifyMeltUnit').value,currentFraction:C0.toString(),additionMassG:x.toString(),additiveId:aid,additiveName:ad?.name||'',additiveFraction:P.toString(),yieldFraction:Y.toString(),finalFraction:C1.toString(),targetFraction:target?.toString()||null,outputUnit:unit}});
  }catch(e){state.lastVerify=null;byId('saveVerifyHistory').disabled=true;resultError(byId('verifyResult'),e)}
  });
}

function bindYield(){
  byId('yieldDate').value=today();
  byId('yieldElement').addEventListener('change',()=>{const s=byId('yieldAdditive');s.innerHTML=additiveOptions(byId('yieldElement').value);if(s.options.length>1){s.selectedIndex=1;additiveChanged(s,'yieldAdditivePct',byId('yieldElement').value)}});
  byId('yieldAdditive').addEventListener('change',()=>additiveChanged(byId('yieldAdditive'),'yieldAdditivePct',byId('yieldElement').value));
  byId('calcYield').addEventListener('click',async()=>{try{
    const M=E.massToGram(parsePositiveText(byId('yieldMeltMass'),'添加前溶湯量'),byId('yieldMeltUnit').value);
    const C0=E.concentrationToFraction(parsePositiveText(byId('yieldBefore'),'添加前分析値'),byId('yieldBeforeUnit').value);
    const C1=E.concentrationToFraction(parsePositiveText(byId('yieldAfter'),'添加後分析値'),byId('yieldAfterUnit').value);
    const x=E.massToGram(parsePositiveText(byId('yieldAddition'),'実添加量'),byId('yieldAdditionUnit').value);
    const P=E.percentToFraction(parsePositiveText(byId('yieldAdditivePct'),'添加材含有率'));
    const Y=E.calculateYield({meltMassG:M,currentFraction:C0,finalFraction:C1,additionMassG:x,additiveFraction:P});
    let cls='success',note='通常範囲内です。';if(Y.lt(0)){cls='warning';note='0%未満です。入力値や分析値、サンプリングばらつきを確認してください。'}else if(Y.gt(1)){cls='warning';note='100%超です。入力値や分析値、サンプリングばらつきを確認してください。'}
    byId('yieldResult').innerHTML=`<div class="result-card"><h3>逆算結果: ${fmtYield(Y)}</h3><div class="message ${cls}">${note} 値は自動補正していません。</div></div>`;
    state.lastYield={M,C0,C1,x,P,Y};byId('saveYieldRecord').disabled=false;
    const element=byId('yieldElement').value,aid=byId('yieldAdditive').value,ad=state.additives.find(a=>a.id===aid);
    await persistCalculationHistory({id:S.uid('calc'),date:new Date().toISOString(),type:'歩留まり逆算',summary:`${element}: ${fmtYield(Y)}`,payload:{element,meltMassG:M.toString(),meltUnit:byId('yieldMeltUnit').value,beforeFraction:C0.toString(),afterFraction:C1.toString(),additionMassG:x.toString(),additiveId:aid,additiveName:ad?.name||'',additiveFraction:P.toString(),yieldFraction:Y.toString()}});
  }catch(e){state.lastYield=null;byId('saveYieldRecord').disabled=true;resultError(byId('yieldResult'),e)}
  });
  byId('saveYieldRecord').addEventListener('click',async()=>{const r=state.lastYield;if(!r)return;const aid=byId('yieldAdditive').value;const ad=state.additives.find(a=>a.id===aid);await S.put('yieldRecords',{id:S.uid('yield'),date:byId('yieldDate').value||today(),createdAt:new Date().toISOString(),element:byId('yieldElement').value,additiveId:aid,additiveName:ad?.name||'手入力',meltMassG:r.M.toString(),beforeFraction:r.C0.toString(),afterFraction:r.C1.toString(),additionMassG:r.x.toString(),additiveFraction:r.P.toString(),yieldFraction:r.Y.toString(),adopted:r.Y.gte(0)&&r.Y.lte(1),memo:byId('yieldMemo').value});toast('歩留まり実績を保存しました。');loadYieldRecords()});
  byId('refreshYieldRecords').addEventListener('click',loadYieldRecords);byId('yieldFilterElement').addEventListener('change',loadYieldRecords);
}
async function loadYieldRecords(){
  let rows=await S.getAll('yieldRecords');const f=byId('yieldFilterElement').value;if(f)rows=rows.filter(r=>r.element===f);rows.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  const adopted=rows.filter(r=>r.adopted!==false).map(r=>Number(r.yieldFraction)*100).filter(Number.isFinite);const stats=calcStats(adopted);byId('yieldStats').innerHTML=[['件数',stats.n],['平均',stats.n?stats.avg.toFixed(getDecimals().yield)+' %':'—'],['中央値',stats.n?stats.median.toFixed(getDecimals().yield)+' %':'—'],['最小',stats.n?stats.min.toFixed(getDecimals().yield)+' %':'—'],['最大',stats.n?stats.max.toFixed(getDecimals().yield)+' %':'—'],['標準偏差',stats.n?stats.sd.toFixed(getDecimals().yield)+' %':'—']].map(x=>`<div class="stat"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
  byId('yieldRecordRows').innerHTML=rows.length?rows.map(r=>`<tr><td>${esc(r.date)}</td><td>${esc(r.element)}</td><td>${esc(r.additiveName||'')}</td><td>${fmtYield(r.yieldFraction)}</td><td><input class="adopt-yield" data-id="${esc(r.id)}" type="checkbox" ${r.adopted!==false?'checked':''}></td><td>${esc(r.memo||'')}</td><td><button class="secondary use-yield" data-id="${esc(r.id)}">配合に使用</button> <button class="ghost delete-yield" data-id="${esc(r.id)}">削除</button></td></tr>`).join(''):`<tr><td colspan="7" class="muted">実績はありません。</td></tr>`;
  $$('.adopt-yield').forEach(c=>c.addEventListener('change',async()=>{const r=await S.get('yieldRecords',c.dataset.id);r.adopted=c.checked;await S.put('yieldRecords',r);loadYieldRecords()}));
  $$('.delete-yield').forEach(b=>b.addEventListener('click',async()=>{if(confirm('この実績を削除しますか？')){await S.remove('yieldRecords',b.dataset.id);loadYieldRecords()}}));
  $$('.use-yield').forEach(b=>b.addEventListener('click',async()=>{const r=await S.get('yieldRecords',b.dataset.id);if(!availableElements().includes(r.element)){toast(`元素「${r.element}」は現在の添加材マスタにありません。主元素を登録してから使用してください。`);return;}setSelectedYield(`${r.element}|${r.additiveId}`,r);showScreen('blend');let card=$$('.element-card').find(c=>c.querySelector('.row-element').value===r.element);if(!card)card=addBlendRow({element:r.element,additiveId:r.additiveId});card.querySelector('.row-element').value=r.element;updateRowAdditives(card,r.additiveId);card.querySelector('.row-yield-source').value='record';card.querySelector('.row-yield').value=D.from(r.yieldFraction).mul(100).toString();toast('選択した歩留まり実績を配合計算へ反映しました。')}));
}
function calcStats(a){if(!a.length)return{n:0,avg:0,median:0,min:0,max:0,sd:0};const s=[...a].sort((x,y)=>x-y);const n=s.length,avg=s.reduce((x,y)=>x+y,0)/n,median=n%2?s[(n-1)/2]:(s[n/2-1]+s[n/2])/2,sd=Math.sqrt(s.reduce((x,y)=>x+(y-avg)**2,0)/n);return{n,avg,median,min:s[0],max:s[n-1],sd}}

function bindDilution(){
  byId('calcDilution').addEventListener('click',async()=>{try{
    const M=E.massToGram(parsePositiveText(byId('dilMeltMass'),'現在溶湯量'),byId('dilMeltUnit').value);
    const C0=E.concentrationToFraction(parsePositiveText(byId('dilCurrent'),'現在濃度'),byId('dilCurrentUnit').value);
    const Ct=E.concentrationToFraction(parsePositiveText(byId('dilTarget'),'目標濃度'),byId('dilTargetUnit').value);
    const Cd=E.concentrationToFraction(parsePositiveText(byId('dilDiluent'),'希釈材濃度'),byId('dilDiluentUnit').value);
    const x=E.calculateDilutionMass({meltMassG:M,currentFraction:C0,targetFraction:Ct,diluentFraction:Cd});
    const final=(M.mul(C0).add(x.mul(Cd))).div(M.add(x),48);
    byId('dilutionResult').innerHTML=`<div class="result-card"><h3>希釈計算結果</h3><div class="result-values"><div><span>必要希釈材量</span><strong>${fmtMass(x)}</strong></div><div><span>希釈後総重量</span><strong>${fmtMassInUnit(M.add(x),byId('dilMeltUnit').value,getDecimals().melt)}</strong></div><div><span>希釈後濃度</span><strong>${fmtConc(final,byId('dilTargetUnit').value)}</strong></div></div></div>`;
    state.lastDilution={M,C0,Ct,Cd,x,final};byId('saveDilutionHistory').disabled=true;
    await persistCalculationHistory({id:S.uid('calc'),date:new Date().toISOString(),type:'希釈計算',summary:`希釈材 ${fmtMass(x)}`,payload:{meltMassG:M.toString(),meltUnit:byId('dilMeltUnit').value,currentFraction:C0.toString(),targetFraction:Ct.toString(),diluentFraction:Cd.toString(),dilutionMassG:x.toString(),finalFraction:final.toString()}});
  }catch(e){state.lastDilution=null;byId('saveDilutionHistory').disabled=true;resultError(byId('dilutionResult'),e)}
  });
}

function resetScaleForm(){
  state.editingScaleId=null;byId('scaleForm').reset();byId('scaleResolutionUnit').value='g';byId('scaleSubmitBtn').textContent='追加';byId('cancelScaleEdit').classList.add('hidden');
}
function resetAdditiveForm(){
  state.editingAdditiveId=null;byId('additiveForm').reset();byId('additiveSubmitBtn').textContent='追加';byId('cancelAdditiveEdit').classList.add('hidden');
}
async function startScaleEdit(id){
  const s=await S.get('scales',id);if(!s)return;
  state.editingScaleId=id;byId('scaleName').value=s.name||'';byId('scaleResolution').value=scaleResolutionValue(s).toString();byId('scaleResolutionUnit').value=scaleUnit(s);byId('scaleSubmitBtn').textContent='更新';byId('cancelScaleEdit').classList.remove('hidden');byId('scaleName').focus();
}
async function startAdditiveEdit(id){
  const a=await S.get('additives',id);if(!a)return;
  state.editingAdditiveId=id;byId('addName').value=a.name||'';byId('addType').value=a.type||'pure';byId('addElement').value=a.mainElement||'';byId('addPct').value=additivePct(a,a.mainElement);byId('addNote').value=a.note||a.maker||'';byId('additiveSubmitBtn').textContent='更新';byId('cancelAdditiveEdit').classList.remove('hidden');byId('addName').focus();
}

function bindSettings(){
  const d=state.settings.decimals;byId('setDecMelt').value=d.melt;byId('setDecAddition').value=d.addition;byId('setDecPpm').value=d.ppm;byId('setDecPpb').value=d.ppb;byId('setDecWt').value=d.wt;byId('setDecYield').value=d.yield;
  byId('saveSettings').addEventListener('click',()=>{state.settings.decimals={melt:+byId('setDecMelt').value,addition:+byId('setDecAddition').value,ppm:+byId('setDecPpm').value,ppb:+byId('setDecPpb').value,wt:+byId('setDecWt').value,yield:+byId('setDecYield').value};S.saveSettings(state.settings);toast('設定を保存しました。')});
  byId('restartTutorial').addEventListener('click',()=>AppTutorial.open(true));

  byId('scaleForm').addEventListener('submit',async e=>{e.preventDefault();const name=byId('scaleName').value.trim(),res=byId('scaleResolution').value.trim(),unit=byId('scaleResolutionUnit').value;try{
    if(!name)throw new Error('名称を入力してください。');if(D.from(res).lte(0))throw new Error('分解能は0より大きくしてください。');
    const resolutionG=E.massToGram(res,unit);const current=state.editingScaleId?await S.get('scales',state.editingScaleId):null;
    await S.put('scales',{...(current||{}),id:current?.id||S.uid('scale'),name,resolutionValue:D.from(res).toString(),resolutionUnit:unit,resolutionG:resolutionG.toString(),active:current?.active!==false});
    const edited=!!current;resetScaleForm();await refreshMasters();toast(edited?'天秤を更新しました。':'天秤を追加しました。');
  }catch(err){toast(err.message||'天秤の入力内容を確認してください。')}});
  byId('cancelScaleEdit').addEventListener('click',resetScaleForm);

  byId('additiveForm').addEventListener('submit',async e=>{e.preventDefault();const pct=byId('addPct').value.trim();try{
    if(D.from(pct).lte(0)||D.from(pct).gt(100))throw new Error('含有率は0より大きく100以下にしてください。');
    const el=byId('addElement').value.trim(),name=byId('addName').value.trim();if(!el||!name)throw new Error('名称と主元素を入力してください。');
    const current=state.editingAdditiveId?await S.get('additives',state.editingAdditiveId):null;const type=byId('addType').value;
    await S.put('additives',{...(current||{}),id:current?.id||S.uid('add'),name,type,mainElement:el,components:[{element:el,wtPercent:D.from(pct).toString()}],purity:type==='pure'?D.from(pct).toString():'',maker:'',partNo:current?.partNo||'',note:byId('addNote').value.trim(),active:current?.active!==false});
    const edited=!!current;resetAdditiveForm();await refreshMasters();toast(edited?'添加材を更新しました。':'添加材を追加しました。');
  }catch(err){toast(err.message||'添加材の入力内容を確認してください。')}});
  byId('cancelAdditiveEdit').addEventListener('click',resetAdditiveForm);

  byId('exportScaleCsv').addEventListener('click',async()=>{const rows=await S.getAll('scales');X.exportCsv(['ID','名称','分解能','単位','分解能_g','有効'],rows.map(x=>[x.id,x.name,scaleResolutionValue(x).toString(),scaleUnit(x),x.resolutionG,x.active!==false?'有効':'無効']),`Al配合計算_天秤マスタ_${X.dateStamp()}.csv`)});
  byId('exportAdditiveCsv').addEventListener('click',async()=>{const rows=await S.getAll('additives');X.exportCsv(['ID','名称','分類','主元素','含有率_wt%','備考','有効'],rows.map(x=>[x.id,x.name,x.type==='pure'?'純元素':'母合金',x.mainElement,additivePct(x,x.mainElement),x.note||x.maker||'',x.active!==false?'有効':'無効']),`Al配合計算_添加材マスタ_${X.dateStamp()}.csv`)});

  byId('exportJson').addEventListener('click',async()=>X.exportJson(await S.exportAll()));
  byId('exportYieldCsv').addEventListener('click',async()=>{const r=await S.getAll('yieldRecords');X.exportCsv(['日付','元素','添加材','溶湯量_g','添加前_質量分率','添加後_質量分率','添加量_g','歩留まり_%','採用','メモ'],r.map(x=>[x.date,x.element,x.additiveName,x.meltMassG,x.beforeFraction,x.afterFraction,x.additionMassG,D.from(x.yieldFraction).mul(100).toString(),x.adopted!==false?'採用':'除外',x.memo||'']),`Al配合計算_歩留まり実績_${X.dateStamp()}.csv`)});
  byId('exportHistoryCsv').addEventListener('click',async()=>{const r=await S.getAll('calculationHistory');X.exportCsv(['日時','種類','概要','データJSON'],r.map(x=>[x.date,x.type,x.summary,JSON.stringify(x.payload||{})]),`Al配合計算_計算履歴_${X.dateStamp()}.csv`)});
  byId('importJson').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{const data=JSON.parse(await f.text());const mode=byId('importMode').value;if(mode==='replace'&&!confirm('全置換すると現在の保存データは削除されます。続行しますか？'))return;await S.importAll(data,mode);state.settings=S.getSettings();await refreshMasters();await renderPresetOptions();await loadYieldRecords();await loadHistory();toast('バックアップを復元しました。')}catch(err){toast('復元に失敗しました: '+err.message)}finally{e.target.value=''}});
  byId('clearHistory').addEventListener('click',async()=>{if(confirm('計算履歴をすべて削除しますか？')){await S.clear('calculationHistory');loadHistory();toast('履歴を削除しました。')}});
}
async function renderMasterTables(){
  const scales=await S.getAll('scales');
  byId('scaleRows').innerHTML=scales.map(s=>`<tr><td>${esc(s.name)}</td><td>${esc(scaleResolutionText(s))}</td><td><input class="scale-active" data-id="${esc(s.id)}" type="checkbox" ${s.active!==false?'checked':''}></td><td><div class="table-actions"><button class="ghost scale-edit" data-id="${esc(s.id)}">編集</button><button class="ghost scale-delete" data-id="${esc(s.id)}">削除</button></div></td></tr>`).join('');
  $$('.scale-active').forEach(c=>c.addEventListener('change',async()=>{const s=await S.get('scales',c.dataset.id);s.active=c.checked;await S.put('scales',s);refreshMasters()}));
  $$('.scale-edit').forEach(b=>b.addEventListener('click',()=>startScaleEdit(b.dataset.id)));
  $$('.scale-delete').forEach(b=>b.addEventListener('click',async()=>{if(confirm('この天秤を削除しますか？')){if(state.editingScaleId===b.dataset.id)resetScaleForm();await S.remove('scales',b.dataset.id);refreshMasters()}}));

  const adds=await S.getAll('additives');
  byId('additiveRows').innerHTML=adds.map(a=>`<tr><td>${esc(a.name)}</td><td>${a.type==='pure'?'純元素':'母合金'}</td><td>${esc(a.mainElement)}</td><td>${esc(additivePct(a,a.mainElement))} wt%</td><td>${esc(a.note||a.maker||'')}</td><td><input class="add-active" data-id="${esc(a.id)}" type="checkbox" ${a.active!==false?'checked':''}></td><td><div class="table-actions"><button class="ghost add-edit" data-id="${esc(a.id)}">編集</button><button class="ghost add-delete" data-id="${esc(a.id)}">削除</button></div></td></tr>`).join('');
  $$('.add-active').forEach(c=>c.addEventListener('change',async()=>{const a=await S.get('additives',c.dataset.id);a.active=c.checked;await S.put('additives',a);refreshMasters()}));
  $$('.add-edit').forEach(b=>b.addEventListener('click',()=>startAdditiveEdit(b.dataset.id)));
  $$('.add-delete').forEach(b=>b.addEventListener('click',async()=>{if(confirm('この添加材を削除しますか？')){if(state.editingAdditiveId===b.dataset.id)resetAdditiveForm();await S.remove('additives',b.dataset.id);refreshMasters()}}));
}
async function loadHistory(){const rows=(await S.getAll('calculationHistory')).sort((a,b)=>String(b.date).localeCompare(String(a.date)));byId('historyRows').innerHTML=rows.length?rows.map(r=>`<tr><td>${new Date(r.date).toLocaleString('ja-JP')}</td><td>${esc(r.type)}</td><td>${esc(r.summary||'')}</td><td><button class="ghost delete-history" data-id="${esc(r.id)}">削除</button></td></tr>`).join(''):`<tr><td colspan="4" class="muted">履歴はありません。</td></tr>`;$$('.delete-history').forEach(b=>b.addEventListener('click',async()=>{await S.remove('calculationHistory',b.dataset.id);loadHistory()}))}

function bindHelp(){
  document.addEventListener('click',e=>{const h=e.target.closest('[data-help]');if(h){openHelpModal(HELP[h.dataset.help]||'ヘルプ情報がありません。');return}if(e.target.closest('[data-action="open-help"]'))showScreen('help');if(e.target.closest('[data-action="close-modal"]'))closeModal();});
  byId('modalBackdrop').addEventListener('click',closeModal);
}
function openHelpModal(text){byId('helpModalBody').innerHTML=`<p>${esc(text)}</p>`;byId('modalBackdrop').classList.remove('hidden');byId('helpModal').classList.remove('hidden')}
function closeModal(){byId('helpModal').classList.add('hidden');if(byId('tutorialModal').classList.contains('hidden'))byId('modalBackdrop').classList.add('hidden')}

function setupPWA(){if('serviceWorker'in navigator){navigator.serviceWorker.register('./service-worker.js').then(reg=>{reg.addEventListener('updatefound',()=>{const w=reg.installing;w?.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller)byId('updateNotice').classList.remove('hidden')})})}).catch(()=>{});byId('reloadApp').addEventListener('click',()=>location.reload())}}

async function init(){
  state.settings=S.getSettings();await S.openDB();await S.seedDefaults();await S.migrateAppData();await refreshMasters();
  bindNavigation();bindVerify();bindYield();bindDilution();bindSettings();bindHelp();AppTutorial.init();setupPWA();
  byId('addBlendRow').addEventListener('click',()=>addBlendRow({element:availableElements()[0]||''}));byId('calcBlend').addEventListener('click',calcBlend);byId('saveBlendHistory').addEventListener('click',()=>saveBlendHistory(false));byId('loadBlendSample').addEventListener('click',loadBlendSample);
  byId('saveBlendPreset').addEventListener('click',saveBlendPreset);byId('applyBlendPreset').addEventListener('click',applyBlendPreset);byId('deleteBlendPreset').addEventListener('click',deleteBlendPreset);
  addBlendRow({element:availableElements().includes('Cu')?'Cu':(availableElements()[0]||''),additiveId:availableElements().includes('Cu')?'add-5n-cu':'',additivePct:availableElements().includes('Cu')?'99.999':''});
  // initialize single-form additive selections
  ['verify','yield'].forEach(prefix=>{const elem=byId(`${prefix}Element`).value;const sel=byId(`${prefix}Additive`);sel.innerHTML=additiveOptions(elem);if(sel.options.length>1){sel.selectedIndex=1;additiveChanged(sel,`${prefix}AdditivePct`,elem)}});
  showScreen(state.settings.lastScreen||'blend');setTimeout(()=>AppTutorial.open(false),250);
}

document.addEventListener('DOMContentLoaded',()=>init().catch(e=>{console.error(e);document.body.innerHTML=`<main style="padding:24px;font-family:sans-serif"><h1>起動エラー</h1><pre>${esc(e.stack||e.message)}</pre></main>`}));
})();
