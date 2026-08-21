(function(root){
  'use strict';
  const VERSION=1;
  const steps=[
    {title:'Al 配合計算へようこそ',body:'このアプリは、純Al～高純度Alの配合計算、添加確認、歩留まり逆算、希釈計算をオフラインで行うためのPWAです。'},
    {title:'1. 溶湯量を入力',body:'配合計算では最初に溶湯量と単位を設定します。g / kg / tに対応しています。'},
    {title:'2. 元素条件を設定',body:'Cu、Si、Tiなど元素ごとに、現在濃度・目標濃度・添加材・歩留まりを入力します。複数元素も同時計算できます。'},
    {title:'3. 天秤分解能を反映',body:'理論添加量だけでなく、登録した天秤分解能に基づく下側・四捨五入・上側の秤量候補と、そのときの予想最終濃度を確認できます。'},
    {title:'4. 歩留まりを逆算',body:'実際の添加量と添加前後の分析値から歩留まりを逆算し、実績として保存できます。異常値は自動補正しません。'},
    {title:'5. データをバックアップ',body:'添加材、天秤、歩留まり実績、計算履歴はブラウザに保存されます。定期的にJSONバックアップを作成してください。'},
    {title:'準備完了',body:'「サンプル入力」を使うと、Al 500 kg / Cu 2→50 ppm / Cu 99.999 wt% / 歩留まり95%の例をすぐ試せます。'}
  ];
  let idx=0;
  function el(id){return document.getElementById(id)}
  function open(force=false){
    const seen=localStorage.getItem('tutorialVersionSeen');
    if(!force && String(VERSION)===seen) return;
    idx=0; render();
    el('modalBackdrop').classList.remove('hidden'); el('tutorialModal').classList.remove('hidden');
  }
  function close(mark=true){
    if(mark) localStorage.setItem('tutorialVersionSeen',String(VERSION));
    el('tutorialModal').classList.add('hidden'); el('modalBackdrop').classList.add('hidden');
  }
  function render(){
    const s=steps[idx]; el('tutorialTitle').textContent=s.title; el('tutorialBody').innerHTML=`<p>${s.body}</p>`;
    el('tutorialProgress').style.setProperty('--progress',`${((idx+1)/steps.length)*100}%`);
    el('tutorialPrev').disabled=idx===0; el('tutorialNext').textContent=idx===steps.length-1?'完了':'次へ';
  }
  function init(){
    el('tutorialNext').addEventListener('click',()=>{ if(idx===steps.length-1) close(true); else {idx++;render();}});
    el('tutorialPrev').addEventListener('click',()=>{if(idx>0){idx--;render();}});
    el('tutorialSkip').addEventListener('click',()=>close(true));
  }
  root.AppTutorial={VERSION,init,open,close};
})(typeof self!=='undefined'?self:window);
