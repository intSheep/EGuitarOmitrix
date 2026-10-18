import { initializePractice, recentPractice, exerciseStatus, assignmentHTML, resumeHTML, stageGuidanceHTML, logFormHTML, historyHTML } from './practice-ui.js';
import { STAGES, KINDS, validateCourse, videoUrl, primaryLessons, filterEntries,
  relatedEntries, shortTitle, formatDuration, readCursor, rememberVideo } from './course.js';

const root = document.querySelector('#app');
const dialog = document.querySelector('#lesson-dialog');
const escape = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
let course;
let lastOpened;
let lastFocus;
let noticeTimer;
let pendingFocus;
let pendingDialog;

function currentRoute() {
  const [name, query = ''] = location.hash.slice(1).split('?');
  const params = new URLSearchParams(query);
  return {
    name: ['practice', 'catalog', 'plan', 'history'].includes(name) ? name : 'practice',
    stage: /^[1-7]$/.test(params.get('stage')) ? Number(params.get('stage')) : (course?.entries.find(e => e.id === recentPractice()?.entryId)?.stage || 1),
    params,
  };
}

function videoLink(entry, label, className = 'button primary') {
  const accessible = label ? '' : ` aria-label="在 B站打开 ${escape(shortTitle(entry))}，${pageLabel(entry)}（新标签页）"`;
  return `<a class="${className}" href="${escape(videoUrl(course, entry))}"
    target="_blank" rel="noopener noreferrer" data-video-id="${entry.id}"${accessible}>${label}${icon('external')}</a>`;
}

function pageLabel(entry) { return `P${String(entry.page).padStart(3, '0')}`; }

function stagePills(stage, all = false) {
  return `<div class="stage-pills" aria-label="选择课程阶段">
    ${all ? `<button type="button" data-stage="all" aria-pressed="${stage === 'all'}">全部</button>` : ''}
    ${STAGES.map(item => `<button type="button" data-stage="${item.id}" aria-label="W${item.id} ${item.title}"
      aria-pressed="${stage === item.id}">W${item.id}</button>`).join('')}
    </div>`;
}

function selectedEntry(route) {
  const entries = primaryLessons(course, route.stage);
  return course.entries.find(entry => entry.kind === 'lesson' && entry.stage === route.stage && entry.id === route.params.get('lesson')) ||
    entries.find(entry => entry.id === recentPractice()?.entryId) ||
    entries.find(entry => entry.id === lastOpened?.id) || entries[0];
}

function lessonDetail(entry, { modal = false } = {}) {
  const related = relatedEntries(course, entry);
  return `${modal ? `<button type="button" class="dialog-close icon-button" aria-label="关闭课程详情">${icon('close')}</button>` : ''}
    <img class="detail-art" src="./assets/fretboard.svg" alt="" aria-hidden="true">
    <div class="detail-meta"><span>${entry.stage ? `W${entry.stage}` : '课程资料'}${entry.exercises.length ? ` / EX${String(entry.exercises[0]).padStart(2, '0')}` : ''}</span>
      <span class="kind-tag">${KINDS[entry.kind]}${entry.legacy ? ' · 旧版' : ''}</span></div>
    <h2 ${modal ? 'id="lesson-dialog-title"' : ''}>${escape(shortTitle(entry))}</h2>
    <p class="detail-source">${pageLabel(entry)}<span>·</span>${icon('clock')}视频 ${formatDuration(entry.durationSeconds)}</p>
    ${videoLink(entry, '在 B站打开本课', 'button primary wide')}
    <p class="outbound-hint">在新标签页打开对应分集</p>
    ${entry.kind === 'lesson' ? '<button class="text-link jump-log" type="button">记录这次练习 ↓</button>' : ''}
    ${assignmentHTML(entry)}
    ${entry.kind === 'lesson' ? logFormHTML(entry) : ''}
    <section class="detail-section related-section"><h3>配套视频${related.length ? `<span class="count">${related.length}</span>` : ''}</h3>
      ${related.length ? `<ul>${related.map(media => `<li><div><span class="kind-tag">${KINDS[media.kind]}</span>
        <strong>${escape(shortTitle(media))}</strong><small>${pageLabel(media)} · ${formatDuration(media.durationSeconds)}</small></div>
        ${videoLink(media, '', 'icon-button')}</li>`).join('')}</ul>` : '<p class="subtle">目录中暂无关联的伴奏、示范或跟练。</p>'}</section>
    <details class="source-details"><summary>原课信息</summary><p>${escape(entry.title)}</p><p>${course.bvid} · CID ${entry.id}</p></details>`;
}

function renderPractice(route) {
  const stage = STAGES.find(item => item.id === route.stage);
  const lessons = primaryLessons(course, route.stage);
  const selected = selectedEntry(route);
  const intro = course.entries.find(entry => entry.stage === route.stage && entry.kind === 'intro' && !entry.legacy);
  return `<div class="page-heading"><div><p class="eyebrow">电吉他入门课程</p><h1>练习台</h1>
    <p class="page-subtitle">选择练习，查看原课与配套视频。</p></div>
    ${lastOpened ? videoLink(lastOpened, `最近浏览 · ${pageLabel(lastOpened)}`, 'button secondary') : ''}</div>
    ${resumeHTML()}
    <section class="stage-bar" aria-label="课程阶段">${stagePills(route.stage)}
      <div class="stage-context"><strong>${stage.title}</strong><span>${stage.subtitle}</span></div></section>
    ${stageGuidanceHTML()}
    <div class="practice-layout">
      <section class="exercise-list" aria-label="W${stage.id} 练习列表"><div class="list-heading"><h2>本章练习<span>${lessons.length}</span></h2>
        ${intro ? videoLink(intro, '章节导言', 'text-link') : ''}</div>
        <ul>${lessons.map(entry => `<li class="exercise-row ${entry.id === selected.id ? 'is-selected' : ''}">
          <button type="button" data-select="${entry.id}" aria-pressed="${entry.id === selected.id}" class="exercise-select">
            <span class="exercise-number">${String(entry.exercises[0]).padStart(2, '0')}</span>
            <span class="exercise-label"><strong>${escape(shortTitle(entry))}</strong>
              <span>${pageLabel(entry)}<span class="metadata-dot">·</span>视频 ${formatDuration(entry.durationSeconds)}</span><span class="exercise-progress">${exerciseStatus(entry.id)}</span></span>
          </button>${videoLink(entry, '', 'icon-button row-video')}</li>`).join('')}</ul>
        <div class="list-footer">W${stage.id} 是课程阶段，不限定在一周内完成。</div></section>
      <aside class="lesson-detail" aria-label="当前练习详情">${lessonDetail(selected)}</aside>
    </div>
    <div class="workspace-note">${icon('book')}需要其他视频？<a href="#catalog">在完整目录中查找讲解、伴奏和旧版本 ${icon('arrow')}</a></div>`;
}

function catalogCard(entry) {
  return `<article class="catalog-card"><div class="catalog-card-top"><span class="kind-tag">${KINDS[entry.kind]}</span>
    ${entry.legacy ? '<span class="legacy-tag">旧版</span>' : ''}<span class="duration">${formatDuration(entry.durationSeconds)}</span></div>
    <h2>${escape(shortTitle(entry))}</h2><p class="entry-meta">${entry.stage ? `W${entry.stage} · ` : ''}${pageLabel(entry)}${entry.exercises.length ? ` · EX${entry.exercises.join(' / EX')}` : ''}</p>
    <div class="card-actions"><button type="button" class="text-link" data-lesson="${entry.id}">查看详情</button>
      ${videoLink(entry, '打开视频', 'button secondary compact')}</div></article>`;
}

function renderCatalog(params) {
  const stage = /^[1-7]$/.test(params.get('stage')) ? Number(params.get('stage')) : 'all';
  const kind = KINDS[params.get('kind')] ? params.get('kind') : 'all';
  const query = params.get('q') || '';
  const includeLegacy = params.get('legacy') === '1';
  const entries = filterEntries(course, { stage, kind, query, includeLegacy });
  return `<div class="page-heading"><div><p class="eyebrow">BV1FT411Z7iu</p><h1>课程目录</h1>
    <p class="page-subtitle">140 条视频，包含 66 个当前教学练习，以及导言、伴奏、示范和旧版本。</p></div></div>
    <form id="catalog-filters" class="catalog-controls"><label class="search-box">${icon('search')}
      <input type="search" name="q" id="course-search" placeholder="搜索练习、歌曲或分集，如 P070" value="${escape(query)}" aria-label="搜索课程">
      <button class="button secondary compact" type="submit">搜索</button></label>
      <div class="filter-row">${stagePills(stage, true)}<label class="select-field"><span>类型</span><select name="kind" id="kind-filter">
        <option value="all">全部类型</option>${Object.entries(KINDS).map(([key, label]) => `<option value="${key}" ${key === kind ? 'selected' : ''}>${label}</option>`).join('')}
        </select></label><label class="legacy-switch"><input type="checkbox" id="legacy-filter" ${includeLegacy ? 'checked' : ''}>包含旧版</label></div></form>
    <p class="result-summary" role="status">${entries.length} 条结果${includeLegacy ? ' · 包含旧版本' : ' · 默认隐藏旧版本'}</p>
    ${entries.length ? `<div class="catalog-grid">${entries.map(catalogCard).join('')}</div>` : `<div class="empty-state">${icon('search')}
      <h2>没有匹配的课程</h2><p>请更换关键词，或调整阶段、类型和旧版筛选。</p><a class="button secondary" href="#catalog">清除筛选</a></div>`}`;
}

function renderPlan() {
  return `<div class="page-heading"><div><p class="eyebrow">产品范围</p><h1>功能计划</h1>
    <p class="page-subtitle">先连接课程与练习，再完善记录和反馈。</p></div></div>
    <div class="roadmap-cards"><article class="roadmap-card live"><div class="roadmap-top"><span class="roadmap-number">01</span>
      <span class="kind-tag">当前版本</span></div><h2>课程与视频入口</h2><p>按章节选择练习，搜索完整目录，打开对应的讲解、伴奏与示范。</p>
      <a class="text-link" href="#practice">打开练习台 ${icon('arrow')}</a></article>
      <article class="roadmap-card"><div class="roadmap-top"><span class="roadmap-number">02</span><span class="kind-tag">当前版本</span></div>
      <h2>任务整理与练习记录</h2><p>已整理字幕任务及待核对项；可手动记录时长、自报程度、BPM和下次重点，并查看历史、导出备份。</p>
      <span class="plan-note">区分老师要求、本次计划和实际练习。</span></article>
      <article class="roadmap-card"><div class="roadmap-top"><span class="roadmap-number">03</span><span class="kind-tag">后续调研</span></div>
      <h2>乐谱与跟练</h2><p>先转录并校对视频中的谱例，再评估网页内播放、调速、循环和 Guitar Pro 8 文件联动。</p>
      <span class="plan-note">转谱不作为核心练习记录的前置条件。</span></article></div>`;
}

function render({ focusMain = false } = {}) {
  const route = currentRoute();
  root.innerHTML = route.name === 'catalog' ? renderCatalog(route.params) : route.name === 'plan' ? renderPlan() : route.name === 'history' ? historyHTML(route.params) : renderPractice(route);
  document.querySelectorAll('[data-nav]').forEach(link => {
    if (link.dataset.nav === route.name) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
  root.setAttribute('aria-busy', 'false');
  document.title = `${{ practice: '练习台', catalog: '课程目录', plan: '功能计划', history: '练习记录' }[route.name]} · EGuitarOmitrix`;
  if (focusMain) document.querySelector('#main').focus({ preventScroll: true });
}

function showLesson(entry, trigger) {
  if (!entry) return;
  lastFocus = trigger;
  document.querySelector('#dialog-content').innerHTML = lessonDetail(entry, { modal: true });
  if (!dialog.open) dialog.showModal();
}

function showNotice(message) {
  const notice = document.querySelector('#notice');
  notice.textContent = message;
  notice.hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { notice.hidden = true; }, 5000);
}

document.addEventListener('click', event => {
  const target = event.target.closest('button, a');
  if (!target) return;
  if (target.classList.contains('skip-link')) {
    event.preventDefault(); document.querySelector('#main').focus(); return;
  }
  if (!course) return;
  if (target.dataset.videoId) {
    const entry = course.entries.find(item => item.id === target.dataset.videoId);
    if (entry) {
      lastOpened = entry;
      let saved = false;
      try { saved = rememberVideo(localStorage, entry); } catch { /* The outbound link still works. */ }
      if (!saved) showNotice('无法记住本次浏览位置，视频仍可正常打开。');
    }
  }
  if (target.dataset.lesson) showLesson(course.entries.find(entry => entry.id === target.dataset.lesson), target);
  if (target.matches('.dialog-close')) dialog.close();
  if (target.dataset.select) {
    const route = currentRoute();
    const params = new URLSearchParams(route.params);
    params.set('stage', route.stage);
    params.set('lesson', target.dataset.select);
    pendingFocus = target.dataset.select;
    pendingDialog = window.matchMedia('(max-width: 760px)').matches;
    const hash = `#practice?${params}`;
    if (location.hash === hash) {
      if (pendingDialog) showLesson(course.entries.find(entry => entry.id === pendingFocus), target);
      pendingFocus = null; pendingDialog = false;
    } else location.hash = hash;
  }
  if (target.dataset.stage) {
    const route = currentRoute();
    const params = route.name === 'catalog' ? new URLSearchParams(route.params) : new URLSearchParams();
    if (target.dataset.stage === 'all') params.delete('stage'); else params.set('stage', target.dataset.stage);
    location.hash = `${route.name === 'catalog' ? 'catalog' : 'practice'}${params.size ? `?${params}` : ''}`;
  }
  if (target.id === 'retry-load') initialize();
});

document.addEventListener('submit', event => {
  if (event.target.id === 'catalog-filters') { event.preventDefault(); updateFilters(); }
});
document.addEventListener('change', event => {
  if (['kind-filter', 'legacy-filter'].includes(event.target.id)) updateFilters();
});

function updateFilters() {
  const params = new URLSearchParams(currentRoute().params);
  const query = document.querySelector('#course-search').value.trim();
  const kind = document.querySelector('#kind-filter').value;
  if (query) params.set('q', query); else params.delete('q');
  if (kind !== 'all') params.set('kind', kind); else params.delete('kind');
  if (document.querySelector('#legacy-filter').checked) params.set('legacy', '1'); else params.delete('legacy');
  location.hash = `catalog${params.size ? `?${params}` : ''}`;
}

dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
dialog.addEventListener('close', () => { if (lastFocus?.isConnected) lastFocus.focus(); });
window.addEventListener('hashchange', () => {
  if (!course) return;
  if (dialog.open) dialog.close();
  const selecting = Boolean(pendingFocus);
  render({ focusMain: !selecting });
  if (selecting) {
    const target = document.querySelector(`[data-select="${pendingFocus}"]`);
    if (pendingDialog) showLesson(course.entries.find(entry => entry.id === pendingFocus), target);
    else target?.focus({ preventScroll: true });
    pendingFocus = null; pendingDialog = false;
  } else window.scrollTo({ top: 0, behavior: 'instant' });
});
window.addEventListener('pageshow', event => { if (event.persisted && course) render(); });

async function initialize() {
  root.setAttribute('aria-busy', 'true');
  try {
    const response = await fetch('./data/course.json');
    if (!response.ok) throw new Error('Could not load catalog');
    course = validateCourse(await response.json());
    try { lastOpened = readCursor(localStorage, course); } catch { lastOpened = null; }
    const assignmentResponse = await fetch('./data/assignments.json');
    if (!assignmentResponse.ok) throw new Error('Assignment catalog unavailable');
    const assignments = await assignmentResponse.json();
    await initializePractice(course, assignments, () => render(), showNotice);
    render();
  } catch {
    root.setAttribute('aria-busy', 'false');
    root.innerHTML = `<div class="empty-state"><h1>课程目录暂时无法加载</h1><p>请重试，或直接打开 B站原课程。</p>
      <button class="button primary" id="retry-load">重新加载</button>
      <a class="text-link" href="https://www.bilibili.com/video/BV1FT411Z7iu/" target="_blank" rel="noopener noreferrer">前往原课程 ${icon('external')}</a></div>`;
  }
}

initialize();
