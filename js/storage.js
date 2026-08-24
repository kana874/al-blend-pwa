(function (root) {
  'use strict';
  const DB_NAME = 'AlBlendPWA';
  const DB_VERSION = 1;
  const STORES = ['additives', 'yieldRecords', 'calculationHistory', 'scales', 'productRecipes', 'appMetadata'];
  let dbPromise = null;

  const DEFAULT_SETTINGS = {
    massUnit: 'kg', concUnit: 'ppm', additionUnit: 'auto', summaryAdditionUnit: 'auto', roundingMode: 'half-up',
    decimals: { melt: 3, addition: 3, ppm: 3, ppb: 1, wt: 6, yield: 2 },
    lastScreen: 'blend'
  };

  function uid(prefix = 'id') {
    if (root.crypto && root.crypto.randomUUID) return `${prefix}-${root.crypto.randomUUID()}`;
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('additives')) db.createObjectStore('additives', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('yieldRecords')) {
          const s = db.createObjectStore('yieldRecords', { keyPath: 'id' });
          s.createIndex('element', 'element'); s.createIndex('additiveId', 'additiveId'); s.createIndex('date', 'date');
        }
        if (!db.objectStoreNames.contains('calculationHistory')) {
          const s = db.createObjectStore('calculationHistory', { keyPath: 'id' });
          s.createIndex('date', 'date'); s.createIndex('type', 'type');
        }
        if (!db.objectStoreNames.contains('scales')) db.createObjectStore('scales', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('productRecipes')) db.createObjectStore('productRecipes', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('appMetadata')) db.createObjectStore('appMetadata', { keyPath: 'key' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function tx(store, mode, fn) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const s = t.objectStore(store);
      let result;
      try { result = fn(s); } catch (e) { reject(e); return; }
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error || new Error('Transaction aborted'));
    });
  }

  async function getAll(store) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction(store, 'readonly').objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }
  async function get(store, key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction(store, 'readonly').objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function put(store, value) { await tx(store, 'readwrite', s => s.put(value)); return value; }
  async function putMany(store, values) {
    const rows = Array.isArray(values) ? values : [];
    await tx(store, 'readwrite', s => { rows.forEach(value => s.put(value)); });
    return rows;
  }
  async function remove(store, key) { await tx(store, 'readwrite', s => s.delete(key)); }
  async function clear(store) { await tx(store, 'readwrite', s => s.clear()); }

  function getSettings() {
    try {
      const raw = JSON.parse(localStorage.getItem('alBlendSettings') || '{}');
      return { ...DEFAULT_SETTINGS, ...raw, decimals: { ...DEFAULT_SETTINGS.decimals, ...(raw.decimals || {}) } };
    } catch (_) { return JSON.parse(JSON.stringify(DEFAULT_SETTINGS)); }
  }
  function saveSettings(settings) { localStorage.setItem('alBlendSettings', JSON.stringify(settings)); }

  async function seedDefaults() {
    const meta = await get('appMetadata', 'seeded');
    if (meta) return;
    const additives = [
      { id:'add-5n-cu', name:'Cu', type:'pure', mainElement:'Cu', components:[{element:'Cu', wtPercent:'99.999'}], purity:'99.999', maker:'', partNo:'', note:'', active:true },
      { id:'add-5n-si', name:'Si', type:'pure', mainElement:'Si', components:[{element:'Si', wtPercent:'99.999'}], purity:'99.999', maker:'', partNo:'', note:'', active:true },
      { id:'add-5n-ti', name:'Ti', type:'pure', mainElement:'Ti', components:[{element:'Ti', wtPercent:'99.999'}], purity:'99.999', maker:'', partNo:'', note:'', active:true },
      { id:'add-al5ti', name:'Al-5Ti', type:'master', mainElement:'Ti', components:[{element:'Ti', wtPercent:'5.000'}], purity:'', maker:'', partNo:'', note:'Al balance', active:true }
    ];
    const scales = [
      { id:'scale-001', name:'0.001 g 天秤', resolutionValue:'0.001', resolutionUnit:'g', resolutionG:'0.001', active:true },
      { id:'scale-01', name:'0.01 g 天秤', resolutionValue:'0.01', resolutionUnit:'g', resolutionG:'0.01', active:true },
      { id:'scale-1', name:'0.1 g 天秤', resolutionValue:'0.1', resolutionUnit:'g', resolutionG:'0.1', active:true },
      { id:'scale-100', name:'1 g 天秤', resolutionValue:'1', resolutionUnit:'g', resolutionG:'1', active:true }
    ];
    for (const a of additives) await put('additives', a);
    for (const s of scales) await put('scales', s);
    await put('appMetadata', { key:'seeded', value:true, at:new Date().toISOString() });
    await put('appMetadata', { key:'schemaVersion', value:1 });
  }

  async function migrateAppData() {
    const presetKey = 'migration-1.0.2-restore-pure-presets-without-5n-label';
    if (!(await get('appMetadata', presetKey))) {
      const presets = [
        { id:'add-5n-cu', name:'Cu', type:'pure', mainElement:'Cu', components:[{element:'Cu', wtPercent:'99.999'}], purity:'99.999', maker:'', partNo:'', note:'', active:true },
        { id:'add-5n-si', name:'Si', type:'pure', mainElement:'Si', components:[{element:'Si', wtPercent:'99.999'}], purity:'99.999', maker:'', partNo:'', note:'', active:true },
        { id:'add-5n-ti', name:'Ti', type:'pure', mainElement:'Ti', components:[{element:'Ti', wtPercent:'99.999'}], purity:'99.999', maker:'', partNo:'', note:'', active:true }
      ];
      for (const preset of presets) {
        const current = await get('additives', preset.id);
        if (current) await put('additives', { ...current, name:preset.name });
        else await put('additives', preset);
      }
      await put('appMetadata', { key:presetKey, value:true, at:new Date().toISOString() });
    }

    const key = 'migration-1.0.4-scale-unit-and-additive-note';
    if (!(await get('appMetadata', key))) {
      for (const scale of await getAll('scales')) {
        const resolutionUnit = scale.resolutionUnit === 'kg' ? 'kg' : 'g';
        const resolutionValue = scale.resolutionValue || (resolutionUnit === 'kg'
          ? String(Number(scale.resolutionG || 0) / 1000)
          : String(scale.resolutionG || ''));
        await put('scales', { ...scale, resolutionUnit, resolutionValue });
      }
      for (const additive of await getAll('additives')) {
        if ((!additive.note || additive.note === '') && additive.maker) {
          await put('additives', { ...additive, note:additive.maker, maker:'' });
        }
      }
      await put('appMetadata', { key, value:true, at:new Date().toISOString() });
    }

    // Ver.1.4.0: standard blend presets supplied by the user.
    // Existing same-name presets are preserved and are never overwritten.
    const preset140Key = 'migration-1.4.0-standard-blend-presets';
    if (!(await get('appMetadata', preset140Key))) {
      const additives = await getAll('additives');
      const scales = await getAll('scales');
      const recipes = await getAll('productRecipes');
      const existingNames = new Set(recipes.filter(r => r && r.kind === 'blendPreset').map(r => String(r.name || '').trim().toLowerCase()));
      const additiveFor = (element, preferredId) => additives.find(a => a.id === preferredId && a.active !== false) || additives.find(a => a.active !== false && String(a.mainElement || '').toLowerCase() === element.toLowerCase());
      const pctFor = (additive, element) => {
        if (!additive) return '';
        const c = (additive.components || []).find(x => String(x.element || '').toLowerCase() === element.toLowerCase()) || (additive.components || [])[0];
        return c ? String(c.wtPercent ?? '') : '';
      };
      const cu = additiveFor('Cu', 'add-5n-cu');
      const si = additiveFor('Si', 'add-5n-si');
      const oneGramScale = scales.find(s => s.active !== false && Number(s.resolutionG) === 1) || null;
      const defs = [
        ['025C',    [['Cu','0.25','wt%']]],
        ['03C',     [['Cu','0.30','wt%']]],
        ['05C',     [['Cu','0.50','wt%']]],
        ['1C',      [['Cu','1','wt%']]],
        ['2C',      [['Cu','2','wt%']]],
        ['4C',      [['Cu','4','wt%']]],
        ['8C',      [['Cu','8','wt%']]],
        ['02S05C',  [['Cu','0.50','wt%'],['Si','0.20','wt%']]],
        ['075S05C', [['Cu','0.50','wt%'],['Si','0.75','wt%']]],
        ['08S03C',  [['Cu','0.30','wt%'],['Si','0.80','wt%']]],
        ['08S05C',  [['Cu','0.50','wt%'],['Si','0.80','wt%']]],
        ['1S004C',  [['Cu','0.04','wt%'],['Si','1','wt%']]],
        ['1S05C',   [['Cu','0.50','wt%'],['Si','1','wt%']]],
        ['03S',     [['Si','0.30','wt%']]],
        ['05S',     [['Si','0.50','wt%']]],
        ['08S',     [['Si','0.80','wt%']]],
        ['1S',      [['Si','1','wt%']]],
        ['1.2S',    [['Si','1.20','wt%']]],
        ['30ppmS',  [['Si','30','ppm']]]
      ];
      for (const [name, targets] of defs) {
        if (existingNames.has(name.toLowerCase())) continue;
        const rows = targets.map(([element,target,targetUnit]) => {
          const a = element === 'Cu' ? cu : si;
          return {
            element,
            current:'',
            currentUnit:'ppm',
            target,
            targetUnit,
            additiveId:a ? a.id : '',
            additivePct:pctFor(a, element),
            yield:'100',
            yieldSource:'manual'
          };
        });
        await put('productRecipes', {
          id:`default-preset-${name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`,
          kind:'blendPreset',
          name,
          data:{meltUnit:'kg', scaleId:oneGramScale ? oneGramScale.id : '', roundingMode:'half-up', rows},
          systemDefault:true,
          defaultRevision:1,
          createdAt:new Date().toISOString(),
          updatedAt:new Date().toISOString()
        });
        existingNames.add(name.toLowerCase());
      }
      await put('appMetadata', { key:preset140Key, value:true, at:new Date().toISOString() });
    }
  }

  async function exportAll() {
    const data = {};
    for (const s of STORES) data[s] = await getAll(s);
    return {
      appVersion: root.APP_VERSION || '1.4.0', dbSchemaVersion: DB_VERSION,
      exportedAt: new Date().toISOString(), settings: getSettings(), data
    };
  }

  async function importAll(backup, mode = 'merge') {
    if (!backup || !backup.data) throw new Error('バックアップ形式が不正です。');
    if (mode === 'replace') {
      for (const s of STORES) await clear(s);
    }
    for (const s of STORES) {
      const rows = Array.isArray(backup.data[s]) ? backup.data[s] : [];
      for (const row of rows) {
        if (mode === 'merge') {
          const key = row.id ?? row.key;
          if (key != null && await get(s, key)) {
            const copy = { ...row };
            if ('id' in copy) copy.id = uid(copy.id.split('-')[0] || 'id');
            else if ('key' in copy) copy.key = `${copy.key}-${Date.now()}`;
            await put(s, copy);
            continue;
          }
        }
        await put(s, row);
      }
    }
    if (backup.settings) saveSettings({ ...getSettings(), ...backup.settings, decimals:{...getSettings().decimals, ...(backup.settings.decimals||{})} });
  }

  root.AppStorage = { DB_NAME, DB_VERSION, STORES, uid, openDB, getAll, get, put, putMany, remove, clear, getSettings, saveSettings, seedDefaults, migrateAppData, exportAll, importAll };
})(typeof self !== 'undefined' ? self : window);
