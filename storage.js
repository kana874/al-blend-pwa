(function (root) {
  'use strict';
  const DB_NAME = 'AlBlendPWA';
  const DB_VERSION = 1;
  const STORES = ['additives', 'yieldRecords', 'calculationHistory', 'scales', 'productRecipes', 'appMetadata'];
  let dbPromise = null;

  const DEFAULT_SETTINGS = {
    massUnit: 'kg', concUnit: 'ppm', additionUnit: 'auto', roundingMode: 'half-up',
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
    if (await get('appMetadata', key)) return;
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

  async function exportAll() {
    const data = {};
    for (const s of STORES) data[s] = await getAll(s);
    return {
      appVersion: root.APP_VERSION || '1.0.5', dbSchemaVersion: DB_VERSION,
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

  root.AppStorage = { DB_NAME, DB_VERSION, STORES, uid, openDB, getAll, get, put, remove, clear, getSettings, saveSettings, seedDefaults, migrateAppData, exportAll, importAll };
})(typeof self !== 'undefined' ? self : window);
