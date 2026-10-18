export const STAGES = [
  { id: 1, title: '基础动作与识谱', subtitle: '空弦下拨、手指练习、音阶与节奏' },
  { id: 2, title: '交替拨弦与视奏', subtitle: '交替拨弦、第二把位音阶与歌曲' },
  { id: 3, title: '连贯演奏与节奏', subtitle: '滑弦、保留指练习与音阶串连' },
  { id: 4, title: '击弦与调性', subtitle: '三连音、击弦、音程与非 C 调视奏' },
  { id: 5, title: '勾弦与扫弦', subtitle: '勾弦、扫弦、五和弦与指板音记忆' },
  { id: 6, title: '揉弦与和弦', subtitle: '揉弦、击勾弦、三和弦与制音' },
  { id: 7, title: '推弦与歌曲应用', subtitle: '推弦、Shuffle 节奏与歌曲练习' },
];

export const KINDS = {
  lesson: '课程讲解', backing: '伴奏', demo: '示范', followAlong: '跟练',
  intro: '章节导言', outro: '章节小结', preparation: '准备篇', outlook: '展望篇',
};

export function validateCourse(course) {
  if (course?.schemaVersion !== 1 || course.bvid !== 'BV1FT411Z7iu' || !Array.isArray(course.entries)) {
    throw new Error('课程目录格式不兼容');
  }
  const ids = new Set();
  const pages = new Set();
  for (const entry of course.entries) {
    if (!/^\d+$/.test(entry.id) || ids.has(entry.id) || !Number.isInteger(entry.page) || entry.page < 1 ||
        pages.has(entry.page) || typeof entry.title !== 'string' || !KINDS[entry.kind] ||
        !Number.isInteger(entry.stage) || entry.stage < 0 || entry.stage > 7 ||
        !Number.isFinite(entry.durationSeconds) || entry.durationSeconds < 0 ||
        typeof entry.legacy !== 'boolean' || !Array.isArray(entry.exercises) ||
        entry.exercises.some(n => !Number.isInteger(n) || n < 1)) {
      throw new Error('课程目录包含无效或重复条目');
    }
    ids.add(entry.id);
    pages.add(entry.page);
  }
  return course;
}

export function videoUrl(course, entry, startSeconds) {
  const source = course.entries.find(item => item.id === entry.id);
  if (!source || source.page !== entry.page || course.bvid !== 'BV1FT411Z7iu') {
    throw new Error('找不到对应的原课');
  }
  const url = new URL(`https://www.bilibili.com/video/${course.bvid}/`);
  url.searchParams.set('p', String(source.page));
  url.searchParams.set('cid', source.id);
  if (startSeconds !== undefined) {
    if (!Number.isFinite(startSeconds) || startSeconds < 0 || startSeconds > source.durationSeconds) {
      throw new Error('无效的视频时间点');
    }
    url.searchParams.set('t', String(Math.floor(startSeconds)));
  }
  return url.href;
}

export function primaryLessons(course, stage) {
  return course.entries.filter(entry => entry.kind === 'lesson' && !entry.legacy &&
    (stage === undefined || entry.stage === Number(stage))).sort((a, b) => a.page - b.page);
}

export function filterEntries(course, { stage = 'all', kind = 'all', query = '', includeLegacy = false } = {}) {
  const needle = query.trim().toLocaleLowerCase();
  return course.entries.filter(entry => (includeLegacy || !entry.legacy) &&
    (stage === 'all' || entry.stage === Number(stage)) && (kind === 'all' || entry.kind === kind) &&
    (!needle || `${entry.title} P${String(entry.page).padStart(3, '0')}`.toLocaleLowerCase().includes(needle)));
}

export function relatedEntries(course, lesson) {
  return course.entries.filter(entry => entry.id !== lesson.id && entry.stage === lesson.stage &&
    entry.legacy === lesson.legacy && ['backing', 'demo', 'followAlong'].includes(entry.kind) &&
    entry.exercises.some(number => lesson.exercises.includes(number)));
}

export function shortTitle(entry) {
  return entry.title.replace(/^\(旧\)/, '').replace(/^W\d+-(?:EX\d+\s*|INTRO|OUTRO)/, '') || KINDS[entry.kind];
}

export function formatDuration(seconds) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

export function readCursor(storage, course) {
  try {
    const value = JSON.parse(storage.getItem('eguitar:navigation:v1'));
    if (value?.version !== 1 || typeof value.entryId !== 'string') return null;
    return course.entries.find(entry => entry.id === value.entryId) ?? null;
  } catch { return null; }
}

export function rememberVideo(storage, entry) {
  try {
    storage.setItem('eguitar:navigation:v1', JSON.stringify({ version: 1, entryId: entry.id }));
    return true;
  } catch { return false; }
}
