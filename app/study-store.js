import { validateWatch } from './study.js';

export function readStudy(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['watches', 'session']);
    const records = tx.objectStore('watches').getAll();
    const draft = tx.objectStore('session').get('watch');
    tx.oncomplete = () => resolve({ records: records.result, draft: draft.result || null });
    tx.onabort = () => reject(Error('无法读取看课记录'));
  });
}
// Compare the persisted draft within the transaction to protect other tabs.
export function writeWatch(db, next, expected) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('session', 'readwrite'), store = tx.objectStore('session');
    const request = store.get('watch');
    let conflict = false;
    request.onsuccess = () => {
      if (JSON.stringify(request.result || null) !== JSON.stringify(expected)) { conflict = true; tx.abort(); return; }
      if (next) store.put(next, 'watch'); else store.delete('watch');
    };
    tx.oncomplete = resolve;
    tx.onabort = () => reject(Error(conflict ? '看课计时已在另一窗口更新，请刷新查看' : '看课进度未能保存，请重试'));
  });
}
export function saveWatch(db, record, expectedDraft) {
  validateWatch(record);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['watches', 'session'], 'readwrite');
    const store = tx.objectStore('session'), request = store.get('watch');
    request.onsuccess = () => {
      if (JSON.stringify(request.result || null) !== JSON.stringify(expectedDraft)) { tx.abort(); return; }
      tx.objectStore('watches').add(record);
      store.delete('watch');
    };
    tx.oncomplete = resolve;
    tx.onabort = () => reject(Error('看课记录未能保存，计时仍保留，请重试'));
  });
}
export function setWatchDeleted(db, record, expectedDeletedAt) {
  validateWatch(record);
  return new Promise((resolve, reject) => {
    const tx = db.transaction('watches', 'readwrite');
    const store = tx.objectStore('watches'), request = store.get(record.id);
    request.onsuccess = () => {
      if (!request.result || request.result.deletedAt !== expectedDeletedAt) { tx.abort(); return; }
      store.put(record);
    };
    tx.oncomplete = resolve;
    tx.onabort = () => reject(Error('看课记录未能更新，请重试'));
  });
}
