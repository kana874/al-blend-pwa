(function(root){
  'use strict';
  function downloadBlob(content, filename, type='application/octet-stream'){
    const blob = content instanceof Blob ? content : new Blob([content], {type});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function dateStamp(){ return new Date().toISOString().slice(0,10); }
  function exportJson(obj, filename=`Al配合計算_Backup_${dateStamp()}.json`){ downloadBlob(JSON.stringify(obj,null,2), filename, 'application/json;charset=utf-8'); }
  function csvEscape(v){ const s=v==null?'':String(v); return /[",\n\r]/.test(s)?`"${s.replace(/"/g,'""')}"`:s; }
  function exportCsv(headers, rows, filename){ const lines=[headers.map(csvEscape).join(',')]; rows.forEach(r=>lines.push(r.map(csvEscape).join(','))); downloadBlob('\ufeff'+lines.join('\r\n'), filename, 'text/csv;charset=utf-8'); }

  // RFC4180相当の基本CSVパーサー。UTF-8 BOM、CRLF/LF、引用符、引用符内改行に対応。
  function parseCsv(text){
    const src=String(text??'').replace(/^\uFEFF/,'');
    const rows=[]; let row=[]; let field=''; let quoted=false;
    for(let i=0;i<src.length;i++){
      const ch=src[i];
      if(quoted){
        if(ch==='"'){
          if(src[i+1]==='"'){ field+='"'; i++; }
          else quoted=false;
        }else field+=ch;
        continue;
      }
      if(ch==='"'){
        // 空フィールド開始時の引用符だけをクォート開始として扱う。
        if(field==='') quoted=true;
        else field+=ch;
      }else if(ch===','){
        row.push(field); field='';
      }else if(ch==='\r' || ch==='\n'){
        if(ch==='\r' && src[i+1]==='\n') i++;
        row.push(field); field=''; rows.push(row); row=[];
      }else field+=ch;
    }
    if(quoted) throw new Error('CSVの引用符が閉じられていません。');
    if(field!=='' || row.length){ row.push(field); rows.push(row); }
    while(rows.length && rows[rows.length-1].every(v=>String(v).trim()==='')) rows.pop();
    return rows;
  }

  function csvObjects(text){
    const rows=parseCsv(text);
    if(!rows.length) throw new Error('CSVにデータがありません。');
    const headers=rows[0].map(v=>String(v).trim());
    if(headers.some((h,i)=>!h || headers.indexOf(h)!==i)) throw new Error('CSVヘッダーに空欄または重複があります。');
    const data=rows.slice(1).filter(r=>r.some(v=>String(v).trim()!=='')).map((r,rowIndex)=>{
      const obj={}; headers.forEach((h,i)=>{obj[h]=r[i]??'';});
      obj.__rowNumber=rowIndex+2;
      return obj;
    });
    return {headers,data};
  }

  const api={downloadBlob,exportJson,exportCsv,dateStamp,parseCsv,csvObjects};
  root.AppExport=api;
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
})(typeof self!=='undefined'?self:(typeof window!=='undefined'?window:globalThis));
