(function(root){
'use strict';
const catalog=root.PresetCatalogV16;
if(!catalog||!Array.isArray(catalog.JIS_PRESETS))return;
const row=catalog.JIS_PRESETS.find(x=>x&&x.name==='A8011');
if(!row)return;
row.name='A8011A';
row.standard='JIS H 4000';
row.targets=[
  {element:'Si',min:'0.40',max:'0.8'},
  {element:'Fe',min:'0.50',max:'1.0'}
];
})(typeof self!=='undefined'?self:this);
