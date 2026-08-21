(function(){
'use strict';
const E=window.CalcEngine, D=E.Decimal, S=window.AppStorage, X=window.AppExport;
const state={additives:[],scales:[],settings:null,lastBlend:null,lastVerify:null,lastYield:null,lastDilution:null};
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
function roundingLabel(mode){return mode==='ceil'?'切り上げ':mode==='floor'?'切り捨て':'四捨五入'}
function fmtConc(frac,unit){const dp=unit==='ppm'?getDecimals().ppm:unit==='ppb'?getDecimals().ppb:getDecimals().wt;return `${E.fractionToConcentration(frac,unit).toFixed(dp)} ${unit}`}
function fmtYield(frac){return `${D.from(frac).mul(100).toFixed(getDecimals().yield)} %`}
function parsePositiveText(el,name){const v=String(el.value).trim();if(!v)throw new Error(`${name}を入力してください。`);return v}
function setMessage(el,msg,type='muted'){el.className=`message ${type}`;el.textContent=msg}
function resultError(el,e){el.innerHTML=`<div class="message error">${esc(e.message||e)}</div>`}

async function refreshMasters(){
  state.additives=(await S.getAll('additives')).filter(x=>x.active!==false).sort((a,b)=>a.name.localeCompare(b.name,'ja'));
  state.scales=(await S.getAll('scales')).filter(x=>x.active!==false).sort((a,b)=>Number(a.resolutionG)-Number(b.resolutionG));
  renderScaleSelects(); renderAllAdditiveSelects(); renderMasterTables();
}
function renderScaleSelects(){
  const sel=byId('blendScale'); const prev=sel.value; sel.innerHTML=state.scales.map(s=>`<option value="${esc(s.id)}">${esc(s.name)} (${esc(s.resolutionG)} g)</option>`).join('');
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
  const opts=['Cu','Si','Ti','Fe','Mn','Mg','Zn','B'];
  ['verifyElement','yieldElement','yieldFilterElement'].forEach(id=>{const s=byId(id);const cur=s.value;const lead=id==='yieldFilterElement'?'<option value="">全元素</option>':'';s.innerHTML=lead+opts.map(x=>`<option>${x}</option>`).join('');if(cur)s.value=cur;});
}
function additiveChanged(sel,pctId,element){const a=state.additives.find(x=>x.id===sel.value);if(a)byId(pctId).value=additivePct(a,element||a.mainElement)}

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
  div.innerHTML=`
    <div class="element-header"><div class="element-title"><span class="element-index">${rowSeq}</span><strong>元素条件</strong></div><button class="ghost remove-row" type="button">削除</button></div>
    <div class="element-grid">
      <label>元素<input class="row-element" list="elementList" value="${esc(preset.element||'Cu')}"></label>
      <label>現在濃度<div class="input-with-unit"><input class="row-current" inputmode="decimal" value="${esc(preset.current??'')}"/><select class="row-current-unit"><option>wt%</option><option ${!preset.currentUnit||preset.currentUnit==='ppm'?'selected':''}>ppm</option><option>ppb</option></select></div></label>
      <label>目標濃度<div class="input-with-unit"><input class="row-target" inputmode="decimal" value="${esc(preset.target??'')}"/><select class="row-target-unit"><option>wt%</option><option ${!preset.targetUnit||preset.targetUnit==='ppm'?'selected':''}>ppm</option><option>ppb</option></select></div></label>
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
  div.querySelector('.row-element').addEventListener('change',()=>updateRowAdditives(div));
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
    const element=card.querySelector('.row-element').value.trim();if(!element)throw new Error('元素名を入力してください。');
    const current=E.concentrationToFraction(parsePositiveText(card.querySelector('.row-current'),`${element} 現在濃度`),card.querySelector('.row-current-unit').value);
    const target=E.concentrationToFraction(parsePositiveText(card.querySelector('.row-target'),`${element} 目標濃度`),card.querySelector('.row-target-unit').value);
    const pct=parsePositiveText(card.querySelector('.row-additive-pct'),`${element} 添加材含有率`);if(D.from(pct).gt(100))throw new Error(`${element}: 添加材含有率は100%以下にしてください。`);
    const y=parsePositiveText(card.querySelector('.row-yield'),`${element} 歩留まり`);if(D.from(y).lte(0))throw new Error(`${element}: 歩留まりは0%より大きくしてください。`);if(D.from(y).gt(100))toast(`${element}: 歩留まり100%超で計算しています。`);
    const aid=card.querySelector('.row-additive').value;const ad=state.additives.find(a=>a.id===aid);
    rows.push({element,currentFraction:current,targetFraction:target,additiveFraction:E.percentToFraction(pct),yieldFraction:E.percentToFraction(y),additiveId:aid,additiveName:ad?.name||'手入力',yieldSource:card.querySelector('.row-yield-source').value,currentUnit:card.querySelector('.row-current-unit').value,targetUnit:card.querySelector('.row-target-unit').value,card});
  }
  return rows;
}
async function calcBlend(){
  const msg=byId('blendGlobalMessage');try{
    const M=E.massToGram(parsePositiveText(byId('blendMeltMass'),'溶湯量'),byId('blendMeltUnit').value);if(M.lte(0))throw new Error('溶湯量は0より大きくしてください。');
    const rows=await collectBlendRows();const batch=E.calculateMultiElementBatch({meltMassG:M,rows});
    const scale=state.scales.find(s=>s.id===byId('blendScale').value);if(!scale)throw new Error('天秤を設定してください。');const res=D.from(scale.resolutionG);const mode=byId('blendRounding').value;
    const preferred=batch.rows.map(r=>r.theoreticalMassG.quantize(res,mode));
    const recommendedFinal=E.finalConcentrationsForBatch({meltMassG:M,rows:batch.rows,additionMassesG:preferred});
    const totalPreferred=preferred.reduce((s,x)=>s.add(x),D.zero());const finalMass=M.add(totalPreferred);
    byId('blendTotalAddition').textContent=fmtMassByScale(totalPreferred,res);byId('blendFinalMass').textContent=fmtMassByScale(finalMass,res);
    batch.rows.forEach((r,i)=>{
      const card=r.card;const unit=r.targetUnit;const candidates=[['下側',r.theoreticalMassG.quantize(res,'floor')],['四捨五入',r.theoreticalMassG.quantize(res,'half-up')],['上側',r.theoreticalMassG.quantize(res,'ceil')]];
      const unique=[];const seen=new Set();for(const [name,mass] of candidates){if(seen.has(mass.toString()))continue;seen.add(mass.toString());const ms=preferred.slice();ms[i]=mass;const fin=E.finalConcentrationsForBatch({meltMassG:M,rows:batch.rows,additionMassesG:ms})[i];unique.push({name,mass,fin});}
      const out=card.querySelector('.row-result');out.classList.remove('hidden');out.innerHTML=`
        <div><span>理論必要添加量</span><strong>${fmtMass(r.theoreticalMassG)}</strong></div>
        <div><span>推奨秤量値</span><strong>${fmtMassByScale(preferred[i],res)}</strong></div>
        <div><span>推奨時の予想濃度</span><strong>${fmtConc(recommendedFinal[i],unit)}</strong></div>
        <div><span>目標との差</span><strong>${fmtConc(recommendedFinal[i].sub(r.Ct),unit)}</strong></div>
        <div class="scenario-list" style="grid-column:1/-1"><strong>秤量候補</strong>${unique.map(u=>`<div class="${u.mass.eq(preferred[i])?'preferred':''}"><span>${u.name}: ${fmtMassByScale(u.mass,res)}</span><span>${fmtConc(u.fin,unit)}</span></div>`).join('')}</div>`;
    });
    state.lastBlend={M,rows:batch.rows,preferred,recommendedFinal,totalPreferred,finalMass,theoreticalTotalAddition:batch.totalAdditionG,scale,mode,at:new Date().toISOString()};
    byId('saveBlendHistory').disabled=false;setMessage(msg,'計算完了。推奨秤量値は天秤分解能を反映しています。','success');renderBlendDetail();
  }catch(e){state.lastBlend=null;byId('saveBlendHistory').disabled=true;setMessage(msg,e.message,'error')}
}
function renderBlendDetail(){
  const r=state.lastBlend;if(!r)return;
  const p=byId('blendDetailPanel');p.classList.remove('hidden');
  const disclosure=byId('blendDetailDisclosure');if(disclosure)disclosure.open=false;
  const res=D.from(r.scale.resolutionG);const roundedTotal=r.totalPreferred;
  const sumA=r.rows.reduce((sum,x)=>sum.add(x.a),D.zero());
  const sumB=r.rows.reduce((sum,x)=>sum.add(x.b),D.zero());
  const general=`Cₜᵢ = (M·C₀ᵢ + xᵢ·Pᵢ·Yᵢ) / (M + Σxⱼ)\n\naᵢ = M·(Cₜᵢ − C₀ᵢ) / (Pᵢ·Yᵢ)\nbᵢ = Cₜᵢ / (Pᵢ·Yᵢ)\nS = Σxᵢ = Σaᵢ / (1 − Σbᵢ)\nxᵢ = aᵢ + bᵢ·S`;
  const blocks=r.rows.map((x,i)=>{
    const rounded=r.preferred[i];const fin=r.recommendedFinal[i];const unit=x.targetUnit;
    const eq=`a = ${r.M.toString()} × (${x.Ct.toString()} − ${x.C0.toString()}) / (${x.P.toString()} × ${x.Y.toString()}) = ${x.a.toString()} g\nb = ${x.Ct.toString()} / (${x.P.toString()} × ${x.Y.toString()}) = ${x.b.toString()}\nx = a + b × S = ${x.theoreticalMassG.toString()} g\n${roundingLabel(r.mode)}(${r.scale.resolutionG} g) → ${rounded.toString()} g\nC₁ = (${r.M.toString()} × ${x.C0.toString()} + ${rounded.toString()} × ${x.P.toString()} × ${x.Y.toString()}) / (${r.M.toString()} + ${roundedTotal.toString()})\n   = ${E.fractionToConcentration(fin,unit).toString()} ${unit}`;
    return `<div class="formula-block"><h3>${esc(x.element)}</h3><div class="formula-values"><div>現在濃度: ${fmtConc(x.C0,x.currentUnit)}</div><div>目標濃度: ${fmtConc(x.Ct,unit)}</div><div>添加材含有率: ${D.from(x.P).mul(100).toString()} wt%</div><div>歩留まり: ${fmtYield(x.Y)}</div><div>理論添加量: ${fmtMass(x.theoreticalMassG)}</div><div>推奨秤量値: ${fmtMassByScale(rounded,res)}</div></div><div class="formula-equation">${esc(eq)}</div></div>`;
  }).join('');
  byId('blendDetail').innerHTML=`<p class="formula-lead"><strong>標準モデルA</strong>：添加材全量を最終総重量へ加算し、目的元素として有効になる量のみ歩留まり補正します。複数元素では、全添加材による共通の総重量増加を連立で考慮します。</p><div class="formula-block"><h3>使用する式</h3><div class="formula-equation">${esc(general)}</div><div class="formula-values"><div>M = ${r.M.toString()} g</div><div>Σa = ${sumA.toString()} g</div><div>Σb = ${sumB.toString()}</div><div>S = ${r.theoreticalTotalAddition.toString()} g</div><div>天秤分解能 = ${esc(r.scale.resolutionG)} g</div><div>丸め方式 = ${roundingLabel(r.mode)}</div></div><div class="formula-note">濃度は計算内部では質量分率に変換し、中間計算では丸めません。秤量値だけを選択した天秤分解能で量子化し、その値から最終濃度を再計算します。</div></div>${blocks}`;
}
async function saveBlendHistory(){if(!state.lastBlend)return;const r=state.lastBlend;await S.put('calculationHistory',{id:S.uid('calc'),date:new Date().toISOString(),type:'配合計算',summary:`${r.rows.map((x,i)=>`${x.element} ${fmtMass(r.preferred[i])}`).join(' / ')}`,payload:{meltMassG:r.M.toString(),rows:r.rows.map((x,i)=>({element:x.element,currentFraction:x.C0.toString(),targetFraction:x.Ct.toString(),additiveId:x.additiveId,additiveName:x.additiveName,yieldFraction:x.Y.toString(),theoreticalMassG:x.theoreticalMassG.toString(),recommendedMassG:r.preferred[i].toString(),finalFraction:r.recommendedFinal[i].toString()}))}});toast('配合計算を履歴に保存しました。')}
function loadBlendSample(){byId('blendMeltMass').value='500';byId('blendMeltUnit').value='kg';byId('blendRows').innerHTML='';addBlendRow({element:'Cu',current:'2',target:'50',currentUnit:'ppm',targetUnit:'ppm',additiveId:'add-5n-cu',additivePct:'99.999',yield:'95'});toast('サンプル値を入力しました。')}

function bindVerify(){
  byId('verifyElement').addEventListener('change',()=>{const s=byId('verifyAdditive');s.innerHTML=additiveOptions(byId('verifyElement').value);if(s.options.length>1){s.selectedIndex=1;additiveChanged(s,'verifyAdditivePct',byId('verifyElement').value)}});
  byId('verifyAdditive').addEventListener('change',()=>additiveChanged(byId('verifyAdditive'),'verifyAdditivePct',byId('verifyElement').value));
  byId('calcVerify').addEventListener('click',()=>{try{const M=E.massToGram(parsePositiveText(byId('verifyMeltMass'),'溶湯量'),byId('verifyMeltUnit').value);const C0=E.concentrationToFraction(parsePositiveText(byId('verifyCurrent'),'現在濃度'),byId('verifyCurrentUnit').value);const x=E.massToGram(parsePositiveText(byId('verifyAddition'),'実添加量'),byId('verifyAdditionUnit').value);const P=E.percentToFraction(parsePositiveText(byId('verifyAdditivePct'),'添加材含有率'));const Y=E.percentToFraction(parsePositiveText(byId('verifyYield'),'歩留まり'));const C1=E.calculateFinalConcentration({meltMassG:M,currentFraction:C0,additionMassG:x,additiveFraction:P,yieldFraction:Y});const unit=byId('verifyOutputUnit').value;let diff='—';let target=null;if(byId('verifyTarget').value.trim()){target=E.concentrationToFraction(byId('verifyTarget').value,byId('verifyTargetUnit').value);diff=fmtConc(C1.sub(target),unit)};byId('verifyResult').innerHTML=`<div class="result-card"><h3>添加確認結果</h3><div class="result-values"><div><span>推定最終濃度</span><strong>${fmtConc(C1,unit)}</strong></div><div><span>濃度増加量</span><strong>${fmtConc(C1.sub(C0),unit)}</strong></div><div><span>添加後総重量</span><strong>${fmtMass(M.add(x),'melt')}</strong></div>${target?`<div><span>目標との差</span><strong>${diff}</strong></div>`:''}</div></div>`;state.lastVerify={M,C0,x,P,Y,C1,target,unit};byId('saveVerifyHistory').disabled=false}catch(e){state.lastVerify=null;byId('saveVerifyHistory').disabled=true;resultError(byId('verifyResult'),e)}});
  byId('saveVerifyHistory').addEventListener('click',async()=>{const r=state.lastVerify;if(!r)return;await S.put('calculationHistory',{id:S.uid('calc'),date:new Date().toISOString(),type:'添加確認',summary:`${byId('verifyElement').value}: ${fmtConc(r.C1,r.unit)}`,payload:{finalFraction:r.C1.toString()}});toast('添加確認を履歴に保存しました。')});
}

function bindYield(){
  byId('yieldDate').value=today();
  byId('yieldElement').addEventListener('change',()=>{const s=byId('yieldAdditive');s.innerHTML=additiveOptions(byId('yieldElement').value);if(s.options.length>1){s.selectedIndex=1;additiveChanged(s,'yieldAdditivePct',byId('yieldElement').value)}});
  byId('yieldAdditive').addEventListener('change',()=>additiveChanged(byId('yieldAdditive'),'yieldAdditivePct',byId('yieldElement').value));
  byId('calcYield').addEventListener('click',()=>{try{const M=E.massToGram(parsePositiveText(byId('yieldMeltMass'),'添加前溶湯量'),byId('yieldMeltUnit').value);const C0=E.concentrationToFraction(parsePositiveText(byId('yieldBefore'),'添加前分析値'),byId('yieldBeforeUnit').value);const C1=E.concentrationToFraction(parsePositiveText(byId('yieldAfter'),'添加後分析値'),byId('yieldAfterUnit').value);const x=E.massToGram(parsePositiveText(byId('yieldAddition'),'実添加量'),byId('yieldAdditionUnit').value);const P=E.percentToFraction(parsePositiveText(byId('yieldAdditivePct'),'添加材含有率'));const Y=E.calculateYield({meltMassG:M,currentFraction:C0,finalFraction:C1,additionMassG:x,additiveFraction:P});let cls='success',note='通常範囲内です。';if(Y.lt(0)){cls='warning';note='0%未満です。入力値や分析値、サンプリングばらつきを確認してください。'}else if(Y.gt(1)){cls='warning';note='100%超です。入力値や分析値、サンプリングばらつきを確認してください。'}byId('yieldResult').innerHTML=`<div class="result-card"><h3>逆算結果: ${fmtYield(Y)}</h3><div class="message ${cls}">${note} 値は自動補正していません。</div></div>`;state.lastYield={M,C0,C1,x,P,Y};byId('saveYieldRecord').disabled=false}catch(e){state.lastYield=null;byId('saveYieldRecord').disabled=true;resultError(byId('yieldResult'),e)}});
  byId('saveYieldRecord').addEventListener('click',async()=>{const r=state.lastYield;if(!r)return;const aid=byId('yieldAdditive').value;const ad=state.additives.find(a=>a.id===aid);await S.put('yieldRecords',{id:S.uid('yield'),date:byId('yieldDate').value||today(),createdAt:new Date().toISOString(),element:byId('yieldElement').value,additiveId:aid,additiveName:ad?.name||'手入力',meltMassG:r.M.toString(),beforeFraction:r.C0.toString(),afterFraction:r.C1.toString(),additionMassG:r.x.toString(),additiveFraction:r.P.toString(),yieldFraction:r.Y.toString(),adopted:r.Y.gte(0)&&r.Y.lte(1),memo:byId('yieldMemo').value});toast('歩留まり実績を保存しました。');loadYieldRecords()});
  byId('refreshYieldRecords').addEventListener('click',loadYieldRecords);byId('yieldFilterElement').addEventListener('change',loadYieldRecords);
}
async function loadYieldRecords(){
  let rows=await S.getAll('yieldRecords');const f=byId('yieldFilterElement').value;if(f)rows=rows.filter(r=>r.element===f);rows.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  const adopted=rows.filter(r=>r.adopted!==false).map(r=>Number(r.yieldFraction)*100).filter(Number.isFinite);const stats=calcStats(adopted);byId('yieldStats').innerHTML=[['件数',stats.n],['平均',stats.n?stats.avg.toFixed(getDecimals().yield)+' %':'—'],['中央値',stats.n?stats.median.toFixed(getDecimals().yield)+' %':'—'],['最小',stats.n?stats.min.toFixed(getDecimals().yield)+' %':'—'],['最大',stats.n?stats.max.toFixed(getDecimals().yield)+' %':'—'],['標準偏差',stats.n?stats.sd.toFixed(getDecimals().yield)+' %':'—']].map(x=>`<div class="stat"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
  byId('yieldRecordRows').innerHTML=rows.length?rows.map(r=>`<tr><td>${esc(r.date)}</td><td>${esc(r.element)}</td><td>${esc(r.additiveName||'')}</td><td>${fmtYield(r.yieldFraction)}</td><td><input class="adopt-yield" data-id="${esc(r.id)}" type="checkbox" ${r.adopted!==false?'checked':''}></td><td>${esc(r.memo||'')}</td><td><button class="secondary use-yield" data-id="${esc(r.id)}">配合に使用</button> <button class="ghost delete-yield" data-id="${esc(r.id)}">削除</button></td></tr>`).join(''):`<tr><td colspan="7" class="muted">実績はありません。</td></tr>`;
  $$('.adopt-yield').forEach(c=>c.addEventListener('change',async()=>{const r=await S.get('yieldRecords',c.dataset.id);r.adopted=c.checked;await S.put('yieldRecords',r);loadYieldRecords()}));
  $$('.delete-yield').forEach(b=>b.addEventListener('click',async()=>{if(confirm('この実績を削除しますか？')){await S.remove('yieldRecords',b.dataset.id);loadYieldRecords()}}));
  $$('.use-yield').forEach(b=>b.addEventListener('click',async()=>{const r=await S.get('yieldRecords',b.dataset.id);setSelectedYield(`${r.element}|${r.additiveId}`,r);showScreen('blend');let card=$$('.element-card').find(c=>c.querySelector('.row-element').value===r.element);if(!card)card=addBlendRow({element:r.element,additiveId:r.additiveId});card.querySelector('.row-element').value=r.element;updateRowAdditives(card,r.additiveId);card.querySelector('.row-yield-source').value='record';card.querySelector('.row-yield').value=D.from(r.yieldFraction).mul(100).toString();toast('選択した歩留まり実績を配合計算へ反映しました。')}));
}
function calcStats(a){if(!a.length)return{n:0,avg:0,median:0,min:0,max:0,sd:0};const s=[...a].sort((x,y)=>x-y);const n=s.length,avg=s.reduce((x,y)=>x+y,0)/n,median=n%2?s[(n-1)/2]:(s[n/2-1]+s[n/2])/2,sd=Math.sqrt(s.reduce((x,y)=>x+(y-avg)**2,0)/n);return{n,avg,median,min:s[0],max:s[n-1],sd}}

function bindDilution(){
  byId('calcDilution').addEventListener('click',()=>{try{const M=E.massToGram(parsePositiveText(byId('dilMeltMass'),'現在溶湯量'),byId('dilMeltUnit').value);const C0=E.concentrationToFraction(parsePositiveText(byId('dilCurrent'),'現在濃度'),byId('dilCurrentUnit').value);const Ct=E.concentrationToFraction(parsePositiveText(byId('dilTarget'),'目標濃度'),byId('dilTargetUnit').value);const Cd=E.concentrationToFraction(parsePositiveText(byId('dilDiluent'),'希釈材濃度'),byId('dilDiluentUnit').value);const x=E.calculateDilutionMass({meltMassG:M,currentFraction:C0,targetFraction:Ct,diluentFraction:Cd});const final=(M.mul(C0).add(x.mul(Cd))).div(M.add(x),48);byId('dilutionResult').innerHTML=`<div class="result-card"><h3>希釈計算結果</h3><div class="result-values"><div><span>必要希釈材量</span><strong>${fmtMass(x)}</strong></div><div><span>希釈後総重量</span><strong>${fmtMass(M.add(x),'melt')}</strong></div><div><span>希釈後濃度</span><strong>${fmtConc(final,byId('dilTargetUnit').value)}</strong></div></div></div>`;state.lastDilution={M,C0,Ct,Cd,x,final};byId('saveDilutionHistory').disabled=false}catch(e){state.lastDilution=null;byId('saveDilutionHistory').disabled=true;resultError(byId('dilutionResult'),e)}});
  byId('saveDilutionHistory').addEventListener('click',async()=>{const r=state.lastDilution;if(!r)return;await S.put('calculationHistory',{id:S.uid('calc'),date:new Date().toISOString(),type:'希釈計算',summary:`希釈材 ${fmtMass(r.x)}`,payload:{dilutionMassG:r.x.toString()}});toast('希釈計算を履歴に保存しました。')});
}

function bindSettings(){
  const d=state.settings.decimals;byId('setDecMelt').value=d.melt;byId('setDecAddition').value=d.addition;byId('setDecPpm').value=d.ppm;byId('setDecPpb').value=d.ppb;byId('setDecWt').value=d.wt;byId('setDecYield').value=d.yield;
  byId('saveSettings').addEventListener('click',()=>{state.settings.decimals={melt:+byId('setDecMelt').value,addition:+byId('setDecAddition').value,ppm:+byId('setDecPpm').value,ppb:+byId('setDecPpb').value,wt:+byId('setDecWt').value,yield:+byId('setDecYield').value};S.saveSettings(state.settings);toast('設定を保存しました。')});
  byId('restartTutorial').addEventListener('click',()=>AppTutorial.open(true));
  byId('scaleForm').addEventListener('submit',async e=>{e.preventDefault();const name=byId('scaleName').value.trim(),res=byId('scaleResolution').value.trim();try{if(D.from(res).lte(0))throw new Error();await S.put('scales',{id:S.uid('scale'),name,resolutionG:D.from(res).toString(),active:true});e.target.reset();await refreshMasters();toast('天秤を追加しました。')}catch{toast('分解能は0より大きい数値で入力してください。')}});
  byId('additiveForm').addEventListener('submit',async e=>{e.preventDefault();const pct=byId('addPct').value.trim();try{if(D.from(pct).lte(0)||D.from(pct).gt(100))throw new Error();const el=byId('addElement').value.trim();await S.put('additives',{id:S.uid('add'),name:byId('addName').value.trim(),type:byId('addType').value,mainElement:el,components:[{element:el,wtPercent:D.from(pct).toString()}],purity:byId('addType').value==='pure'?D.from(pct).toString():'',maker:byId('addMaker').value.trim(),partNo:'',note:'',active:true});e.target.reset();await refreshMasters();toast('添加材を追加しました。')}catch{toast('含有率は0より大きく100以下で入力してください。')}});
  byId('exportJson').addEventListener('click',async()=>X.exportJson(await S.exportAll()));
  byId('exportYieldCsv').addEventListener('click',async()=>{const r=await S.getAll('yieldRecords');X.exportCsv(['日付','元素','添加材','溶湯量_g','添加前_質量分率','添加後_質量分率','添加量_g','歩留まり_%','採用','メモ'],r.map(x=>[x.date,x.element,x.additiveName,x.meltMassG,x.beforeFraction,x.afterFraction,x.additionMassG,D.from(x.yieldFraction).mul(100).toString(),x.adopted!==false?'採用':'除外',x.memo||'']),`Al配合計算_歩留まり実績_${X.dateStamp()}.csv`)});
  byId('exportHistoryCsv').addEventListener('click',async()=>{const r=await S.getAll('calculationHistory');X.exportCsv(['日時','種類','概要','データJSON'],r.map(x=>[x.date,x.type,x.summary,JSON.stringify(x.payload||{})]),`Al配合計算_計算履歴_${X.dateStamp()}.csv`)});
  byId('importJson').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{const data=JSON.parse(await f.text());const mode=byId('importMode').value;if(mode==='replace'&&!confirm('全置換すると現在の保存データは削除されます。続行しますか？'))return;await S.importAll(data,mode);state.settings=S.getSettings();await refreshMasters();await loadYieldRecords();await loadHistory();toast('バックアップを復元しました。')}catch(err){toast('復元に失敗しました: '+err.message)}finally{e.target.value=''}});
  byId('clearHistory').addEventListener('click',async()=>{if(confirm('計算履歴をすべて削除しますか？')){await S.clear('calculationHistory');loadHistory();toast('履歴を削除しました。')}});
}
async function renderMasterTables(){
  const scales=await S.getAll('scales');byId('scaleRows').innerHTML=scales.map(s=>`<tr><td>${esc(s.name)}</td><td>${esc(s.resolutionG)} g</td><td><input class="scale-active" data-id="${esc(s.id)}" type="checkbox" ${s.active!==false?'checked':''}></td><td><button class="ghost scale-delete" data-id="${esc(s.id)}">削除</button></td></tr>`).join('');
  $$('.scale-active').forEach(c=>c.addEventListener('change',async()=>{const s=await S.get('scales',c.dataset.id);s.active=c.checked;await S.put('scales',s);refreshMasters()}));$$('.scale-delete').forEach(b=>b.addEventListener('click',async()=>{if(confirm('この天秤を削除しますか？')){await S.remove('scales',b.dataset.id);refreshMasters()}}));
  const adds=await S.getAll('additives');byId('additiveRows').innerHTML=adds.map(a=>`<tr><td>${esc(a.name)}</td><td>${a.type==='pure'?'純元素':'母合金'}</td><td>${esc(a.mainElement)}</td><td>${esc(additivePct(a,a.mainElement))} wt%</td><td>${esc(a.maker||'')}</td><td><input class="add-active" data-id="${esc(a.id)}" type="checkbox" ${a.active!==false?'checked':''}></td><td><button class="ghost add-delete" data-id="${esc(a.id)}">削除</button></td></tr>`).join('');
  $$('.add-active').forEach(c=>c.addEventListener('change',async()=>{const a=await S.get('additives',c.dataset.id);a.active=c.checked;await S.put('additives',a);refreshMasters()}));$$('.add-delete').forEach(b=>b.addEventListener('click',async()=>{if(confirm('この添加材を削除しますか？')){await S.remove('additives',b.dataset.id);refreshMasters()}}));
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
  state.settings=S.getSettings();await S.openDB();await S.seedDefaults();await S.migrateAppData();fillElementSelects();await refreshMasters();
  const datalist=document.createElement('datalist');datalist.id='elementList';datalist.innerHTML=['Cu','Si','Ti','Fe','Mn','Mg','Zn','B'].map(x=>`<option value="${x}">`).join('');document.body.appendChild(datalist);
  bindNavigation();bindVerify();bindYield();bindDilution();bindSettings();bindHelp();AppTutorial.init();setupPWA();
  byId('addBlendRow').addEventListener('click',()=>addBlendRow({element:'Cu'}));byId('calcBlend').addEventListener('click',calcBlend);byId('saveBlendHistory').addEventListener('click',saveBlendHistory);byId('loadBlendSample').addEventListener('click',loadBlendSample);
  addBlendRow({element:'Cu',additiveId:'add-5n-cu',additivePct:'99.999'});
  // initialize single-form additive selections
  ['verify','yield'].forEach(prefix=>{const elem=byId(`${prefix}Element`).value;const sel=byId(`${prefix}Additive`);sel.innerHTML=additiveOptions(elem);if(sel.options.length>1){sel.selectedIndex=1;additiveChanged(sel,`${prefix}AdditivePct`,elem)}});
  showScreen(state.settings.lastScreen||'blend');setTimeout(()=>AppTutorial.open(false),250);
}

document.addEventListener('DOMContentLoaded',()=>init().catch(e=>{console.error(e);document.body.innerHTML=`<main style="padding:24px;font-family:sans-serif"><h1>起動エラー</h1><pre>${esc(e.stack||e.message)}</pre></main>`}));
})();
