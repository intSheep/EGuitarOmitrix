import { OUTCOMES, activeLogs, latestLog, openPracticeDB, allLogs, saveLog, validateLog, validateBackup, mergePreview, importLogs } from './practice-store.js';
import { shortTitle, videoUrl, formatDuration } from './course.js';
const esc=v=>String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateText=v=>new Date(v).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
const localDate=v=>{const d=new Date(v);return new Date(d-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};
let course, assignments, db, logs=[], storageError='', refresh, notify, pendingBackup, saving=false;
export function recentPractice() { return latestLog(logs); }
export function exerciseStatus(id) { const l=latestLog(logs,id);return l ? `${OUTCOMES[l.outcome]} · 累计 ${activeLogs(logs).filter(x=>x.entryId===id).reduce((n,x)=>n+x.minutes,0).toFixed(1).replace(/\.0$/,'')} 分钟` : '尚无练习记录'; }
export async function initializePractice(c,a,onRefresh,onNotice) {
  course=c;assignments=a;refresh=onRefresh;notify=onNotice;
  try {db=await openPracticeDB();logs=await allLogs(db);logs.forEach(validateLog);} catch(e) {logs=[];storageError=e.message;}
}
export function assignmentHTML(entry) {
  const task=assignments?.items.find(x=>x.entryId===entry.id);
  if(!task) return '';
  const source=task.evidence;
  return `<section class="detail-section assignment-section"><h3>老师布置的练习 <span class="review-status">${task.status==='video-card-reviewed'?'视频末页已核对':source?'字幕整理 · 待听校':'待补充'}</span></h3>
    ${source?`<div class="prescription"><span>原课建议 · 每日</span><strong>${task.dailyMinutes===null?'时长待核对':`${task.dailyMinutes} 分钟`}</strong></div><p>${esc(task.summary)}</p><p class="tempo-note">${esc(task.tempo)}</p>
      ${task.uncertainty?`<p class="uncertain-note">${esc(task.uncertainty)}</p>`:''}
      <a class="text-link" target="_blank" rel="noopener noreferrer" href="${esc(videoUrl(course,entry,source.from))}">核对原课 ${formatDuration(source.from)} ↗</a>
      <details class="evidence-details"><summary>查看整理依据</summary><p>来源：${task.status==='video-card-reviewed'?'视频末页任务卡及画面字幕，已逐项查看':'AI 字幕，尚未逐句听校'}。每日时长不代表每次时长或每天次数。</p><p>时长字幕：${esc(source.doseQuote)}</p>${source.cardAt?`<a class="text-link" href="${esc(videoUrl(course,entry,Math.min(source.cardAt,entry.durationSeconds)))}" target="_blank" rel="noopener noreferrer">查看末页任务卡 ↗</a>`:''}<p>时间段 ${formatDuration(source.from)}–${formatDuration(source.to)} · 版本 ${esc(task.version)}</p></details>`:
      '<p>本课没有独立字幕，暂不推测时长、速度或动作要求。可先打开原课确认，再记录自己的练习。</p>'}
    </section>`;
}
export function resumeHTML() {
  const last=recentPractice();
  if(!last) return storageError?`<p class="storage-error" role="alert">${esc(storageError)} 课程仍可浏览，记录功能暂不可用。</p>`:'';
  const e=course.entries.find(e=>e.id===last.entryId);
  return `<section class="resume-card"><div><p class="eyebrow">上次练到这里 · ${dateText(last.practicedAt)}</p><h2>${esc(shortTitle(e))}</h2><p>${last.minutes} 分钟 · ${OUTCOMES[last.outcome]}${last.bpm?` · ${last.bpm} BPM（自报）`:''}</p><p class="next-focus">下次重点：${esc(last.nextFocus || '继续本项练习，按实际情况记录。')}</p></div><a class="button primary" href="#practice?stage=${e.stage}&lesson=${e.id}">接着练</a></section>`;
}
export function stageGuidanceHTML() {
  return `<details class="stage-guidance"><summary>时间不够时，老师建议怎样安排？</summary><p>${esc(assignments.guidance[0].summary)} W1–W7 是课程阶段，没有到期或补课惩罚。</p><a class="text-link" href="${esc(videoUrl(course,course.entries.find(e=>e.page===2),22))}" target="_blank" rel="noopener noreferrer">核对章节导言 00:22 ↗</a></details>`;
}
export function logFormHTML(entry, log=null) {
  const last=latestLog(logs,entry.id);
  let draft={};
  if(!log) {try {draft=JSON.parse(sessionStorage.getItem(`eguitar:draft:${entry.id}`)||'{}');} catch {}}
  const value=(k,fallback='')=>esc(log?.[k] ?? draft[k] ?? fallback);
  return `<section class="detail-section log-section"><h3>${log?'修改练习记录':'记录这次练习'}</h3>
    ${storageError?`<p class="storage-error" role="alert">${esc(storageError)}</p>`:`
    <form class="practice-form" data-entry="${entry.id}" data-log="${log?.id||''}" data-version="${esc(log?.updatedAt||'')}">
      <div class="form-pair"><label>实际练习（分钟）<input name="minutes" type="number" min="0.1" max="1440" step="0.1" required value="${value('minutes')}" placeholder="例如 10"></label>
      <label>当前程度<select name="outcome" required><option value="">请选择</option>${Object.entries(OUTCOMES).map(([k,v])=>`<option value="${k}" ${value('outcome')===k?'selected':''}>${v}</option>`).join('')}</select></label></div>
      <div class="form-pair"><label>练习时间<input name="practicedAt" type="datetime-local" required value="${log?localDate(log.practicedAt):value('practicedAt',localDate(new Date()))}"></label><label>实际 BPM（可选）<input name="bpm" type="number" min="1" max="400" step="1" value="${value('bpm')}" placeholder="未记录"></label></div>
      <label>下次重点<input name="nextFocus" maxlength="2000" value="${value('nextFocus')}" placeholder="例如：换弦时容易停顿，下次先慢练"></label>
      <label>本次情况（可选）<textarea name="note" rows="2" maxlength="2000" placeholder="哪一段顺了，哪里还容易出错？">${value('note')}</textarea></label>
      <p class="form-hint">填写实际弹琴时间，观看视频不计入。程度与 BPM 均为自我记录，不代表系统评分。</p>
      <p class="form-error" role="alert" hidden></p><button class="button primary wide" type="submit">${log?'保存修改':'保存练习记录'}</button>
    </form>`}
    ${last&&!log?`<div class="last-attempt"><strong>最近一次 · ${dateText(last.practicedAt)}</strong><p>${last.minutes} 分钟 · ${OUTCOMES[last.outcome]}</p><p>下次重点：${esc(last.nextFocus||'未填写')}</p><button class="text-link" data-edit-log="${last.id}">修改这条记录</button></div>`:''}
    <a class="text-link" href="#history?entry=${entry.id}">查看本项历史 →</a></section>`;
}
export function historyHTML(params) {
  const entryId=params.get('entry')||''; const rows=activeLogs(logs).filter(l=>!entryId||l.entryId===entryId);
  const minutes=rows.reduce((n,l)=>n+l.minutes,0);
  return `<div class="page-heading"><div><p class="eyebrow">保存在当前浏览器</p><h1>练习记录</h1><p class="page-subtitle">${rows.length} 次记录 · ${minutes.toFixed(1).replace(/\.0$/,'')} 分钟实际练习</p></div><a class="button secondary" href="#practice">返回练习台</a></div>
    ${storageError?`<p class="storage-error" role="alert">${esc(storageError)}</p>`:''}
    <div class="history-tools"><label>练习筛选 <select id="history-filter"><option value="">全部练习</option>${course.entries.filter(e=>e.kind==='lesson').map(e=>`<option value="${e.id}" ${entryId===e.id?'selected':''}>${e.legacy?'旧版 · ':''}W${e.stage} · ${esc(shortTitle(e))}</option>`).join('')}</select></label>
      <button class="button secondary" id="export-practice" ${!db?'disabled':''}>导出备份</button><label class="button secondary backup-label">导入备份<input type="file" id="import-practice" accept=".json,application/json" ${!db?'disabled':''}></label></div>
    <p class="local-note">清除浏览器数据会移除记录；请定期导出。备份只合并新记录，不覆盖同 ID 的不同版本。</p>
    <div id="import-preview" role="status"></div>
    ${rows.length?`<div class="history-list">${rows.map(l=>{const e=course.entries.find(e=>e.id===l.entryId);return `<article class="history-card"><div><p class="eyebrow">${dateText(l.practicedAt)} · 手动记录${e.legacy?' · 旧版':''}</p><h2>${esc(shortTitle(e))}</h2><p class="history-result">${l.minutes} 分钟 · ${OUTCOMES[l.outcome]}${l.bpm?` · ${l.bpm} BPM（自报）`:''}</p><p>${esc(l.note)}</p><p class="next-focus">下次重点：${esc(l.nextFocus||'未填写')}</p></div><div class="history-actions"><a class="text-link" href="#practice?stage=${e.stage}&lesson=${e.id}">回到练习</a><button class="button secondary compact" data-edit-log="${l.id}">修改</button><button class="text-link" data-delete-log="${l.id}">删除</button></div></article>`;}).join('')}</div>`:'<div class="empty-state"><h2>还没有练习记录</h2><p>打开一项练习，完成后填入实际时长和下次重点。</p></div>'}
    <details class="deleted-history"><summary>已删除的记录（可恢复）</summary>${logs.filter(l=>l.deletedAt).map(l=>`<p>${dateText(l.practicedAt)} · ${esc(shortTitle(course.entries.find(e=>e.id===l.entryId)))} · ${l.minutes} 分钟 <button class="text-link" data-restore-log="${l.id}">恢复</button></p>`).join('')||'<p>没有已删除记录。</p>'}</details>`;
}
function showEdit(id) {
  const log=logs.find(l=>l.id===id);if(!log)return;
  const entry=course.entries.find(e=>e.id===log.entryId);const dialog=document.querySelector('#record-dialog');
  dialog.innerHTML=`<button type="button" class="icon-button record-close" aria-label="关闭记录编辑">×</button><h2 id="record-title">${esc(shortTitle(entry))}</h2>${logFormHTML(entry,log)}`;
  dialog.showModal();
}
async function reload() {logs=await allLogs(db);refresh();}
function download(value,filename) {
  const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
document.addEventListener('input',e=>{
  const form=e.target.closest('.practice-form');if(!form||form.dataset.log)return;
  try {sessionStorage.setItem(`eguitar:draft:${form.dataset.entry}`,JSON.stringify(Object.fromEntries(new FormData(form))));}catch { /* Form remains editable; persistence is confirmed on save only. */ }
});
document.addEventListener('submit',async event=>{
  const form=event.target;if(!form.matches('.practice-form'))return;event.preventDefault();
  if(saving||!db)return;saving=true;const button=form.querySelector('[type=submit]');button.disabled=true;
  const error=form.querySelector('.form-error');error.hidden=true;
  try {
    const f=Object.fromEntries(new FormData(form));const old=logs.find(l=>l.id===form.dataset.log);const now=new Date().toISOString();
    const entryId=form.dataset.entry;const record={id:old?.id||crypto.randomUUID(),entryId,assignmentVersion:old?.assignmentVersion||assignments.items.find(a=>a.entryId===entryId)?.version||'unknown',minutes:Number(f.minutes),outcome:f.outcome,bpm:f.bpm===''?null:Number(f.bpm),practicedAt:new Date(f.practicedAt).toISOString(),note:f.note.trim(),nextFocus:f.nextFocus.trim(),createdAt:old?.createdAt||now,updatedAt:now,deletedAt:null};
    validateLog(record);await saveLog(db,record,form.dataset.version||null);
    try {sessionStorage.removeItem(`eguitar:draft:${entryId}`);}catch {}
    const edit=document.querySelector('#record-dialog');if(edit.open)edit.close();
    const lesson=document.querySelector('#lesson-dialog');if(lesson.open)lesson.close();
    await reload();notify('练习记录已保存，下次可从这里继续。');
  }catch(e){error.hidden=false;error.textContent=e.message||'保存失败，请重试。';button.disabled=false;try {logs=await allLogs(db);}catch {}}finally {saving=false;}
});
document.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.matches('.jump-log')) { const area=b.closest('.lesson-detail, #dialog-content'); area?.querySelector('.log-section')?.scrollIntoView({block:'start',behavior:'instant'}); area?.querySelector('[name=minutes]')?.focus({preventScroll:true}); }
  if(b.matches('.record-close'))document.querySelector('#record-dialog').close();
  if(b.dataset.editLog)showEdit(b.dataset.editLog);
  if(b.dataset.deleteLog||b.dataset.restoreLog) {
    const old=logs.find(l=>l.id===(b.dataset.deleteLog||b.dataset.restoreLog));if(!old)return;b.disabled=true;
    try {await saveLog(db,{...old,deletedAt:b.dataset.deleteLog?new Date().toISOString():null,updatedAt:new Date().toISOString()},old.updatedAt);await reload();notify(b.dataset.deleteLog?'已删除，可在记录页底部恢复。':'记录已恢复。');}catch(error){b.disabled=false;notify(error.message);}
  }
  if(b.id==='export-practice') {
    try {const current=await allLogs(db);download({app:'EGuitarOmitrix',schemaVersion:1,exportedAt:new Date().toISOString(),logs:current},`eguitar-practice-${new Date().toISOString().slice(0,10)}.json`);}catch(error){notify(error.message);}
  }
  if(b.id==='confirm-import'&&pendingBackup) {
    b.disabled=true;try {await importLogs(db,pendingBackup);pendingBackup=null;await reload();notify('备份已合并，已有记录完整保留。');}catch(error){notify(error.message);b.disabled=false;}
  }
});
document.addEventListener('change',async e=>{
  if(e.target.id==='history-filter')location.hash=`history${e.target.value?'?entry='+e.target.value:''}`;
  if(e.target.id!=='import-practice')return;
  const file=e.target.files[0];if(!file)return;pendingBackup=null;
  const area=document.querySelector('#import-preview');
  try {
    if(file.size>10000000)throw new Error('备份超过10 MB，请检查文件。');
    const incoming=validateBackup(JSON.parse(await file.text()),new Set(course.entries.filter(e=>e.kind==='lesson').map(e=>e.id)));
    const current=await allLogs(db);const preview=mergePreview(current,incoming);pendingBackup=incoming;
    area.innerHTML=`<p>将新增 ${preview.additions.length} 条记录，跳过 ${preview.duplicates} 条相同记录；现有记录不覆盖。</p><button class="button primary" id="confirm-import">确认合并</button>`;
  }catch(error){area.textContent=error.message||'无法读取备份，现有记录未修改。';}
  e.target.value='';
});
const recordDialog = document.querySelector('#record-dialog');
recordDialog.addEventListener('close', () => { recordDialog.innerHTML = ''; });
window.addEventListener('hashchange', () => { if(recordDialog.open) recordDialog.close(); });
