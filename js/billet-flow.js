(function(){
'use strict';

const E=window.CalcEngine;
const S=window.AppStorage;
const SETTINGS_KEY='alBlendBilletFlowSettings';
const OUTPUT_DP=3;
const PROCESS_DP=6;

if(!E)return;
const D=E.Decimal;

function byId(id){return document.getElementById(id)}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function required(id,label){const el=byId(id);const value=String(el?.value??'').trim();if(!value)throw new Error(`${label}を入力してください。`);return value}
function fmt(v,dp=OUTPUT_DP){return D.from(v).toFixed(dp)}
function fmtProcess(v,dp=PROCESS_DP){
  const n=D.from(v).toFixed(dp);
  return n.replace(/\.0+$/,'').replace(/(\.\d*?[1-9])0+$/,'$1');
}
function positiveNumber(value,label){const x=D.from(value);if(x.lte(0))throw new Error(`${label}は0より大きい値を入力してください。`);return x}
function loadSettings(){
  try{return JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')||{}}
  catch{return{}}
}
function saveSettings(){
  const data={
    mode:byId('billetUnitWeightMode')?.value||'theoretical',
    diameterPreset:byId('billetDiameterPreset')?.value||'145',
    diameter:byId('billetDiameter')?.value||'145',
    density:byId('billetDensity')?.value||'2.700',
    measuredUnitWeight:byId('billetMeasuredUnitWeight')?.value||'',
    castingSpeed:byId('billetCastingSpeed')?.value||'',
    billetCount:byId('billetCount')?.value||'1',
    billetLength:byId('billetLength')?.value||''
  };
  localStorage.setItem(SETTINGS_KEY,JSON.stringify(data));
}

function panelMarkup(settings){
  const mode=settings.mode==='measured'?'measured':'theoretical';
  const diameterPreset=['145','178','custom'].includes(String(settings.diameterPreset))?String(settings.diameterPreset):'145';
  return `
    <div class="panel-heading billet-heading">
      <div><h2>3. ビレット・流量計算</h2><p class="muted compact-note">ビレット単重 [kg/m]、1本あたり流量 [kg/min]、総流量を計算します。計算過程は教育用に段階表示できます。</p></div>
    </div>
    <div class="billet-layout">
      <div class="billet-inputs">
        <div class="field-grid billet-field-grid">
          <label>単重の算出方法
            <select id="billetUnitWeightMode">
              <option value="theoretical" ${mode==='theoretical'?'selected':''}>径・密度から計算</option>
              <option value="measured" ${mode==='measured'?'selected':''}>実測単重を使用</option>
            </select>
          </label>
          <label class="billet-theoretical-field">径プリセット
            <select id="billetDiameterPreset">
              <option value="145" ${diameterPreset==='145'?'selected':''}>φ145</option>
              <option value="178" ${diameterPreset==='178'?'selected':''}>φ178</option>
              <option value="custom" ${diameterPreset==='custom'?'selected':''}>手入力</option>
            </select>
          </label>
          <label class="billet-theoretical-field">ビレット径
            <div class="input-with-unit"><input id="billetDiameter" type="text" inputmode="decimal" value="${esc(settings.diameter||diameterPreset==='178'?'178':'145')}"><span>mm</span></div>
          </label>
          <label class="billet-theoretical-field">密度
            <div class="input-with-unit"><input id="billetDensity" type="text" inputmode="decimal" value="${esc(settings.density||'2.700')}"><span>g/cm³</span></div>
          </label>
          <label class="billet-measured-field">実測単重
            <div class="input-with-unit"><input id="billetMeasuredUnitWeight" type="text" inputmode="decimal" value="${esc(settings.measuredUnitWeight||'')}"><span>kg/m</span></div>
          </label>
          <label>鋳造速度
            <div class="input-with-unit"><input id="billetCastingSpeed" type="text" inputmode="decimal" value="${esc(settings.castingSpeed||'120')}"><span>mm/min</span></div>
          </label>
          <label>鋳造本数
            <div class="input-with-unit"><input id="billetCount" type="number" inputmode="numeric" min="1" step="1" value="${esc(settings.billetCount||'1')}"><span>本</span></div>
          </label>
          <label>ビレット長さ（任意）
            <div class="input-with-unit"><input id="billetLength" type="text" inputmode="decimal" value="${esc(settings.billetLength||'')}"><span>mm</span></div>
          </label>
        </div>
        <div id="billetMeasuredNote" class="message muted billet-measured-field">実測単重には実径、密度、寸法差などの影響が含まれるため、流量計算では実態に近い値になる場合があります。</div>
        <div class="button-row"><button id="calcBilletFlow" class="primary" type="button">計算</button></div>
        <div id="billetFlowMessage" class="message muted">条件を入力して計算してください。</div>
      </div>
      <div class="billet-results">
        <div class="summary-grid billet-summary-grid" aria-live="polite">
          <div><span>ビレット単重</span><strong id="billetUnitWeightResult">—</strong></div>
          <div><span>1本あたり流量</span><strong id="billetFlowResult">—</strong></div>
          <div><span>総流量</span><strong id="billetTotalFlowResult">—</strong></div>
          <div id="billetOneWeightCard" class="hidden"><span>1本重量</span><strong id="billetOneWeightResult">—</strong></div>
          <div id="billetTotalWeightCard" class="hidden"><span>全本重量</span><strong id="billetTotalWeightResult">—</strong></div>
        </div>
      </div>
    </div>
    <details id="billetCalcDetails" class="formula-details billet-details hidden">
      <summary>計算過程を表示</summary>
      <pre id="billetCalcProcess" class="billet-process"></pre>
    </details>`;
}

function injectPanel(){
  if(byId('billetFlowPanel'))return;
  const blend=byId('screen-blend');
  if(!blend)return;
  const panel=document.createElement('section');
  panel.id='billetFlowPanel';
  panel.className='panel billet-flow-panel';
  panel.innerHTML=panelMarkup(loadSettings());
  const detail=byId('blendDetailPanel');
  if(detail)blend.insertBefore(panel,detail);else blend.appendChild(panel);
}

function syncMode(){
  const measured=byId('billetUnitWeightMode').value==='measured';
  document.querySelectorAll('.billet-theoretical-field').forEach(el=>el.classList.toggle('hidden',measured));
  document.querySelectorAll('.billet-measured-field').forEach(el=>el.classList.toggle('hidden',!measured));
}

function syncDiameterPreset(){
  const preset=byId('billetDiameterPreset').value;
  if(preset==='145'||preset==='178')byId('billetDiameter').value=preset;
}

function syncPresetFromDiameter(){
  const d=String(byId('billetDiameter').value).trim();
  byId('billetDiameterPreset').value=d==='145'?'145':d==='178'?'178':'custom';
}

function resetResults(){
  ['billetUnitWeightResult','billetFlowResult','billetTotalFlowResult','billetOneWeightResult','billetTotalWeightResult'].forEach(id=>{const el=byId(id);if(el)el.textContent='—'});
  byId('billetOneWeightCard')?.classList.add('hidden');
  byId('billetTotalWeightCard')?.classList.add('hidden');
  byId('billetCalcDetails')?.classList.add('hidden');
}

function buildProcessText({mode,unitInfo,unitWeight,flowInfo,totalInfo,weightInfo,diameter,density,measuredUnitWeight,speed,count,length}){
  const lines=[];
  if(mode==='theoretical'){
    const radius=D.from(diameter).div(2,48);
    const volumeMm3=unitInfo.areaMm2.mul(1000);
    const massG=unitInfo.volumeCm3PerM.mul(density);
    lines.push('【1. ビレット断面積】');
    lines.push(`直径 D = ${fmtProcess(diameter)} mm`);
    lines.push(`半径 r = D ÷ 2 = ${fmtProcess(radius)} mm`);
    lines.push('断面積 A = π × r² = π × D² ÷ 4');
    lines.push(`= ${fmtProcess(unitInfo.areaMm2)} mm²`);
    lines.push('');
    lines.push('【2. 1 mあたりの体積】');
    lines.push('長さ 1 m = 1,000 mm');
    lines.push(`体積 V = A × 1,000 = ${fmtProcess(volumeMm3)} mm³`);
    lines.push('1 cm³ = 1,000 mm³ なので');
    lines.push(`V = ${fmtProcess(unitInfo.volumeCm3PerM)} cm³`);
    lines.push('');
    lines.push('【3. ビレット単重】');
    lines.push(`密度 ρ = ${fmtProcess(density)} g/cm³`);
    lines.push(`質量 = V × ρ = ${fmtProcess(massG)} g`);
    lines.push(`= ${fmtProcess(unitWeight)} kg`);
    lines.push(`ビレット単重 = ${fmtProcess(unitWeight)} kg/m`);
  }else{
    lines.push('【1. 実測単重】');
    lines.push(`実測単重 = ${fmtProcess(measuredUnitWeight)} kg/m`);
    lines.push('実測値には実径、密度、寸法差などの影響が含まれます。');
  }
  lines.push('');
  lines.push(`【${mode==='theoretical'?'4':'2'}. 1本あたりの鋳造流量】`);
  lines.push(`鋳造速度 = ${fmtProcess(speed)} mm/min`);
  lines.push(`= ${fmtProcess(flowInfo.speedMPerMin)} m/min`);
  lines.push(`流量 = 単重 × 鋳造速度`);
  lines.push(`= ${fmtProcess(unitWeight)} kg/m × ${fmtProcess(flowInfo.speedMPerMin)} m/min`);
  lines.push(`= ${fmtProcess(flowInfo.flowKgPerMin)} kg/min`);
  lines.push('');
  lines.push(`【${mode==='theoretical'?'5':'3'}. 総流量】`);
  lines.push(`鋳造本数 = ${fmtProcess(count,0)} 本`);
  lines.push(`総流量 = ${fmtProcess(flowInfo.flowKgPerMin)} × ${fmtProcess(count,0)}`);
  lines.push(`= ${fmtProcess(totalInfo.totalFlowKgPerMin)} kg/min`);
  if(weightInfo){
    lines.push('');
    lines.push(`【${mode==='theoretical'?'6':'4'}. ビレット重量】`);
    lines.push(`ビレット長さ = ${fmtProcess(length)} mm = ${fmtProcess(weightInfo.billetLengthM)} m`);
    lines.push(`1本重量 = ${fmtProcess(unitWeight)} kg/m × ${fmtProcess(weightInfo.billetLengthM)} m`);
    lines.push(`= ${fmtProcess(weightInfo.oneBilletWeightKg)} kg`);
    lines.push(`全${fmtProcess(count,0)}本重量 = ${fmtProcess(weightInfo.oneBilletWeightKg)} × ${fmtProcess(count,0)}`);
    lines.push(`= ${fmtProcess(weightInfo.totalBilletWeightKg)} kg`);
  }
  lines.push('');
  lines.push('【単位の考え方】');
  lines.push('kg/m は「長さ1 mあたりの質量」です。');
  lines.push('kg/m × m/min とすると m が約分され、kg/min（1分あたりの質量）になります。');
  return lines.join('\n');
}

async function persistHistory(payload,summary){
  if(!S||typeof S.put!=='function'||typeof S.uid!=='function')return;
  await S.put('calculationHistory',{
    id:S.uid('calc'),
    date:new Date().toISOString(),
    type:'ビレット・流量',
    summary,
    payload
  });
}

async function calculate(){
  const message=byId('billetFlowMessage');
  try{
    const mode=byId('billetUnitWeightMode').value;
    const speed=positiveNumber(required('billetCastingSpeed','鋳造速度'),'鋳造速度');
    const countText=required('billetCount','鋳造本数');
    const count=positiveNumber(countText,'鋳造本数');
    if(!Number.isSafeInteger(Number(count.toString())))throw new Error('鋳造本数は1以上の整数を入力してください。');
    const lengthText=String(byId('billetLength').value||'').trim();
    let length=null;
    if(lengthText)length=positiveNumber(lengthText,'ビレット長さ');

    let unitInfo=null;
    let unitWeight;
    let diameter=null;
    let density=null;
    let measuredUnitWeight=null;

    if(mode==='theoretical'){
      diameter=positiveNumber(required('billetDiameter','ビレット径'),'ビレット径');
      density=positiveNumber(required('billetDensity','密度'),'密度');
      unitInfo=E.calculateBilletUnitWeight({diameterMm:diameter,densityGPerCm3:density});
      unitWeight=unitInfo.unitWeightKgPerM;
    }else{
      measuredUnitWeight=positiveNumber(required('billetMeasuredUnitWeight','実測単重'),'実測単重');
      unitWeight=measuredUnitWeight;
    }

    const flowInfo=E.calculateBilletFlow({unitWeightKgPerM:unitWeight,castingSpeedMmPerMin:speed});
    const totalInfo=E.calculateTotalCastingFlow({flowKgPerMin:flowInfo.flowKgPerMin,billetCount:count});
    const weightInfo=length?E.calculateBilletWeight({unitWeightKgPerM:unitWeight,billetLengthMm:length,billetCount:count}):null;
    const processText=buildProcessText({mode,unitInfo,unitWeight,flowInfo,totalInfo,weightInfo,diameter,density,measuredUnitWeight,speed,count,length});

    byId('billetUnitWeightResult').textContent=`${fmt(unitWeight)} kg/m`;
    byId('billetFlowResult').textContent=`${fmt(flowInfo.flowKgPerMin)} kg/min`;
    byId('billetTotalFlowResult').textContent=`${fmt(totalInfo.totalFlowKgPerMin)} kg/min`;
    if(weightInfo){
      byId('billetOneWeightCard').classList.remove('hidden');
      byId('billetTotalWeightCard').classList.remove('hidden');
      byId('billetOneWeightResult').textContent=`${fmt(weightInfo.oneBilletWeightKg)} kg`;
      byId('billetTotalWeightResult').textContent=`${fmt(weightInfo.totalBilletWeightKg)} kg`;
    }else{
      byId('billetOneWeightCard').classList.add('hidden');
      byId('billetTotalWeightCard').classList.add('hidden');
    }
    byId('billetCalcProcess').textContent=processText;
    byId('billetCalcDetails').classList.remove('hidden');
    message.className='message success';
    message.textContent='計算完了。下の「計算過程を表示」から式と単位変換を確認できます。';
    saveSettings();

    const payload={
      mode,
      diameterMm:diameter?.toString()||null,
      densityGPerCm3:density?.toString()||null,
      measuredUnitWeightKgPerM:measuredUnitWeight?.toString()||null,
      unitWeightKgPerM:unitWeight.toString(),
      castingSpeedMmPerMin:speed.toString(),
      billetCount:count.toString(),
      billetLengthMm:length?.toString()||null,
      oneBilletFlowKgPerMin:flowInfo.flowKgPerMin.toString(),
      totalFlowKgPerMin:totalInfo.totalFlowKgPerMin.toString(),
      oneBilletWeightKg:weightInfo?.oneBilletWeightKg.toString()||null,
      totalBilletWeightKg:weightInfo?.totalBilletWeightKg.toString()||null,
      processText
    };
    const identity=mode==='theoretical'?`φ${fmtProcess(diameter)} mm`:`実測単重 ${fmtProcess(unitWeight)} kg/m`;
    const summary=`${identity} / ${fmtProcess(speed)} mm/min / ${fmtProcess(count,0)}本: ${fmt(totalInfo.totalFlowKgPerMin)} kg/min`;
    try{await persistHistory(payload,summary)}
    catch(e){message.className='message warning';message.textContent='計算結果は有効ですが、計算履歴の保存に失敗しました。'}
  }catch(e){
    resetResults();
    message.className='message error';
    message.textContent=e.message||String(e);
  }
}

function injectHelp(){
  const toc=document.querySelector('#helpContent .help-toc');
  const article=document.querySelector('#helpContent article');
  if(!toc||!article||byId('h-billet-flow'))return;
  const link=document.createElement('a');
  link.href='#h-billet-flow';
  link.textContent='ビレット単重・流量';
  const formulaLink=toc.querySelector('a[href="#h-formulas"]');
  if(formulaLink)toc.insertBefore(link,formulaLink);else toc.appendChild(link);

  const section=document.createElement('div');
  section.innerHTML='<h2 id="h-billet-flow">ビレット単重・鋳造流量</h2><p>径・密度から理論単重を求める方法と、実測単重を直接使用する方法を選べます。径プリセットはφ145 / φ178、密度の初期値は2.700 g/cm³です。</p><pre>単重 [kg/m] = (π × D² / 4) × ρ / 1000\n1本流量 [kg/min] = 単重 [kg/m] × 鋳造速度 [mm/min] / 1000\n総流量 [kg/min] = 1本流量 × 鋳造本数\n1本重量 [kg] = 単重 [kg/m] × ビレット長さ [mm] / 1000</pre><p>Dはビレット径[mm]、ρは密度[g/cm³]です。「計算過程を表示」では断面積、体積、単位変換から順に確認できます。</p>';
  const formulas=byId('h-formulas');
  if(formulas)article.insertBefore(section,formulas);else article.appendChild(section);
}

function bind(){
  byId('billetUnitWeightMode').addEventListener('change',()=>{syncMode();saveSettings()});
  byId('billetDiameterPreset').addEventListener('change',()=>{syncDiameterPreset();saveSettings()});
  byId('billetDiameter').addEventListener('input',syncPresetFromDiameter);
  byId('calcBilletFlow').addEventListener('click',calculate);
  ['billetDiameter','billetDensity','billetMeasuredUnitWeight','billetCastingSpeed','billetCount','billetLength'].forEach(id=>byId(id)?.addEventListener('change',saveSettings));
}

function init(){
  injectPanel();
  if(!byId('billetFlowPanel'))return;
  syncMode();
  bind();
  injectHelp();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
else init();
})();
