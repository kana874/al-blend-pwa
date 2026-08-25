(function(){
'use strict';

const S=window.AppStorage;
const X=window.AppExport;
const HISTORY_GROUPS={
  blend:{label:'配合計算',match:type=>String(type||'')==='配合計算'},
  verify:{label:'添加確認',match:type=>String(type||'')==='添加確認'},
  yield:{label:'歩留まり',match:type=>String(type||'').includes('歩留まり')},
  dilution:{label:'希釈計算',match:type=>String(type||'')==='希釈計算'}
};
let historyFilter='all';

function normalizeTerminology(text){
  return String(text??'').replaceAll('天秤','秤量器').replaceAll('純元素','純金属');
}

function normalizeTextNodes(root){
  if(!root)return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  const nodes=[];
  while(walker.nextNode())nodes.push(walker.currentNode);
  for(const node of nodes){
    const next=normalizeTerminology(node.nodeValue);
    if(next!==node.nodeValue)node.nodeValue=next;
  }
}

function enhanceScaleHelpModal(){
  const body=document.getElementById('helpModalBody');
  if(!body)return;
  normalizeTextNodes(body);
  const text=body.textContent||'';
  if(text.includes('秤量器分解能')&&!text.includes('使用する秤量器の桁数に合わせてください')){
    const p=document.createElement('p');
    p.textContent='表示桁数は、使用する秤量器の桁数に合わせてください。';
    body.appendChild(p);
  }
}

function historyGroupFor(type){
  for(const [key,def] of Object.entries(HISTORY_GROUPS))if(def.match(type))return key;
  return 'other';
}

function applyHistoryFilter(){
  const tbody=document.getElementById('historyRows');
  if(!tbody)return;
  const rows=Array.from(tbody.querySelectorAll('tr'));
  const dataRows=rows.filter(row=>row.cells&&row.cells.length>=4&&!row.querySelector('td[colspan]'));
  const counts={all:dataRows.length,blend:0,verify:0,yield:0,dilution:0};
  let visible=0;

  for(const row of dataRows){
    const type=row.cells[1]?.textContent?.trim()||'';
    const group=historyGroupFor(type);
    if(group in counts)counts[group]++;
    const show=historyFilter==='all'||group===historyFilter;
    row.hidden=!show;
    if(show)visible++;
  }

  document.querySelectorAll('[data-history-count]').forEach(node=>{
    const key=node.dataset.historyCount;
    node.textContent=String(counts[key]??0);
  });
  document.querySelectorAll('[data-history-filter]').forEach(btn=>{
    const active=btn.dataset.historyFilter===historyFilter;
    btn.classList.toggle('active',active);
    btn.setAttribute('aria-selected',active?'true':'false');
    btn.tabIndex=active?0:-1;
  });

  const empty=document.getElementById('historyFilterEmpty');
  if(empty){
    const label=historyFilter==='all'?'履歴':HISTORY_GROUPS[historyFilter]?.label||'履歴';
    empty.textContent=`${label}の履歴はありません。`;
    empty.classList.toggle('hidden',visible>0||dataRows.length===0&&historyFilter==='all');
  }
}

function bindHistoryTabs(){
  document.querySelectorAll('[data-history-filter]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      historyFilter=btn.dataset.historyFilter||'all';
      applyHistoryFilter();
    });
    btn.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight'].includes(event.key))return;
      const tabs=Array.from(document.querySelectorAll('[data-history-filter]'));
      const i=tabs.indexOf(btn);
      const next=event.key==='ArrowRight'?(i+1)%tabs.length:(i-1+tabs.length)%tabs.length;
      tabs[next].focus();tabs[next].click();event.preventDefault();
    });
  });
  const tbody=document.getElementById('historyRows');
  if(tbody)new MutationObserver(()=>applyHistoryFilter()).observe(tbody,{childList:true,subtree:true});
  applyHistoryFilter();
}

function patchDialogs(){
  if(typeof window.confirm==='function'){
    const nativeConfirm=window.confirm.bind(window);
    window.confirm=message=>nativeConfirm(normalizeTerminology(message));
  }
  if(typeof window.alert==='function'){
    const nativeAlert=window.alert.bind(window);
    window.alert=message=>nativeAlert(normalizeTerminology(message));
  }
}

function patchCsvCompatibility(){
  if(!X)return;
  if(typeof X.exportCsv==='function'){
    const originalExportCsv=X.exportCsv.bind(X);
    X.exportCsv=(headers,rows,filename)=>{
      const normalizedHeaders=(headers||[]).map(v=>typeof v==='string'?normalizeTerminology(v):v);
      const normalizedRows=(rows||[]).map(row=>(row||[]).map(v=>typeof v==='string'?normalizeTerminology(v):v));
      return originalExportCsv(normalizedHeaders,normalizedRows,normalizeTerminology(filename));
    };
  }
  if(typeof X.csvObjects==='function'){
    const originalCsvObjects=X.csvObjects.bind(X);
    X.csvObjects=text=>{
      const parsed=originalCsvObjects(text);
      if(Array.isArray(parsed?.data)){
        for(const row of parsed.data){
          if(String(row?.['分類']??'').trim()==='純金属')row['分類']='純元素';
        }
      }
      return parsed;
    };
  }
}

function watchDynamicTerminology(){
  normalizeTextNodes(document.body);
  enhanceScaleHelpModal();
  const target=document.getElementById('appShell')||document.body;
  const toast=document.getElementById('toast');
  const modal=document.getElementById('helpModal');
  const observer=new MutationObserver(mutations=>{
    for(const mutation of mutations){
      for(const node of mutation.addedNodes){
        if(node.nodeType===Node.TEXT_NODE){
          const next=normalizeTerminology(node.nodeValue);
          if(next!==node.nodeValue)node.nodeValue=next;
        }else if(node.nodeType===Node.ELEMENT_NODE){
          normalizeTextNodes(node);
        }
      }
    }
    enhanceScaleHelpModal();
  });
  observer.observe(target,{childList:true,subtree:true,characterData:true});
  if(toast&&!target.contains(toast))observer.observe(toast,{childList:true,subtree:true,characterData:true});
  if(modal&&!target.contains(modal))observer.observe(modal,{childList:true,subtree:true,characterData:true});
}

function init(){
  patchDialogs();
  patchCsvCompatibility();
  bindHistoryTabs();
  watchDynamicTerminology();
  if(S&&typeof S.getAll==='function'){
    // Existing IndexedDB records remain compatible; history is filtered by the stored type label.
  }
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
else init();
})();
