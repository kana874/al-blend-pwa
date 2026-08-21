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
  root.AppExport={downloadBlob,exportJson,exportCsv,dateStamp};
})(typeof self!=='undefined'?self:window);
