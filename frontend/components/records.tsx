import { isClient } from "../platform/client";
import { EffortReview } from "./effort-review";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import * as c from "../controllers/practice";
import { usePractice, clock } from "./common";
import { Button } from "./ui/button";
import {
  KINDS,
  STAGES,
  shortTitle,
  relatedEntries,
  videoUrl,
  filterEntries,
} from "../domain/course";
import { optionalNumber } from "../domain/guidance";
import { OUTCOMES, activeLogs } from "../storage/practice-store";
import {
  reviewGroups,
  chartCoordinates,
  type ChartPoint,
} from "../domain/review-model";
import {
  watchSeconds,
  parseWatchTime,
  totalWatchSeconds,
} from "../domain/study";
import {
  message,
  type Outcome,
  type Entry,
  type PracticeLog,
} from "../domain/types";

export function Materials({ id }: { id: string }) {
  const s = usePractice(),
    e = c.lesson(id),
    a = c.assignment(id);
  const row = (item: Entry, label: string, from?: number) => (
    <a
      key={`${item.id}-${from}`}
      id={item.id === id && from === undefined ? "video-launch" : undefined}
      className="material-row"
      data-watch={item.id}
      href={videoUrl(s.course!, item, from)}
      target="_blank"
      rel="noreferrer"
      onClick={(ev) => {
        if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
        ev.preventDefault();
        void c.launchMaterial(item.id, from).catch((e) => c.notify(message(e)));
      }}
    >
      <span>
        <strong>{label}</strong>
        <small>
          P{String(item.page).padStart(3, "0")} · {shortTitle(item)}
          {from !== undefined ? ` · ${clock(from)}` : ""}
        </small>
      </span>
      <span aria-hidden="true">↗</span>
    </a>
  );
  return (
    <section>
      <h2>课程资料</h2>
      <p className="material-hint">
        {s.draft?.running
          ? "练习计时继续；暂停练习后可单独记录看课时间。"
          : "点击直接打开，返回后确认看课时间。"}
      </p>
      <div className="material-list">
        {row(e, e.kind === "lesson" ? "老师讲解" : KINDS[e.kind])}
        {a?.evidence && row(e, "本课练习要求", a.evidence.from)}
        {relatedEntries(s.course!, e).map((x) => row(x, KINDS[x.kind]))}
      </div>
    </section>
  );
}
export function WatchPanel() {
  const s = usePractice(),
    d = s.watchDraft;
  return d ? <WatchConfirmation key={d.id + String(d.endedAt)} /> : null;
}
function WatchConfirmation() {
  const s = usePractice(),
    d = s.watchDraft!;
  const [value, setValue] = useState(clock(Math.min(86400, watchSeconds(d)))),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const save = async (seconds: number | null) => {
    if (busy) return;
    setBusy(true);
    try {
      await c.confirmViewing(seconds);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="study-panel" aria-label="看课计时">
      <h2>{d.endedAt === null ? "看课计时中" : "确认这次看课时间"}</h2>
      <p>{shortTitle(c.lesson(d.entryId))}</p>
      <strong data-watch-clock>{clock(watchSeconds(d))}</strong>
      {d.endedAt === null ? (
        <Button
          data-action="watch-stop"
          onClick={() => c.run(() => c.endWatch())}
        >
          结束看课计时
        </Button>
      ) : (
        <form
          id="watch-form"
          onSubmit={(e) => {
            e.preventDefault();
            try {
              void save(parseWatchTime(value));
            } catch (e) {
              setError(message(e));
            }
          }}
        >
          <p>视频在外部页面播放，请扣除休息或离开时间。</p>
          <label>
            实际看课时长（分:秒）
            <input
              name="watchDuration"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              pattern="[0-9]{1,4}:[0-5][0-9]"
              required
            />
          </label>
          <p className="study-error" role="alert">
            {error}
          </p>
          <Button type="submit" variant="primary" disabled={busy}>
            保存看课时间
          </Button>
          <Button
            type="button"
            data-action="watch-discard"
            disabled={busy}
            onClick={() => void save(null)}
          >
            不计入
          </Button>
        </form>
      )}
    </section>
  );
}
export function DialogHost() {
  const s = usePractice(),
    ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !s.dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    return () => {
      dialog.close();
      if (previous?.isConnected) previous.focus();
    };
  }, [s.dialog]);
  if (!s.dialog) return null;
  const d = s.dialog;
  return (
    <dialog
      ref={ref}
      id="record-dialog"
      aria-label={
        d.kind === "menu"
          ? "练习菜单"
          : d.kind === "manage"
            ? "备份与管理"
            : d.kind === "goals"
              ? "我的练习目标"
              : d.kind === "result"
                ? "修改本次结果"
                : "课程资料"
      }
      onCancel={() => c.setDialog(null)}
    >
      <Button
        className="dialog-close"
        data-action="close"
        onClick={() => c.setDialog(null)}
      >
        关闭
      </Button>
      {d.kind === "menu" ? (
        <nav className="practice-menu" aria-label="练习菜单">
          <a href="#practice">练习台</a>
          <a href="#catalog">课程目录</a>
          <a href="#history">练习回顾</a>
          {isClient() && (
            <Button
              data-action="client-update"
              onClick={() => {
                c.setDialog(null);
                document
                  .querySelector<HTMLButtonElement>("#client-update")
                  ?.click();
              }}
            >
              检查更新
            </Button>
          )}
        </nav>
      ) : d.kind === "materials" ? (
        <Materials id={d.id} />
      ) : d.kind === "goals" ? (
        <GoalForm id={d.id} />
      ) : d.kind === "result" ? (
        <ResultForm record={d.record} />
      ) : (
        <Manage />
      )}
    </dialog>
  );
}
function GoalForm({ id }: { id: string }) {
  const s = usePractice();
  const [expected] = useState(s.goals),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const g = expected.lessons[id];
  return (
    <form
      id="goal-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        const f = new FormData(e.currentTarget);
        setBusy(true);
        try {
          await c.updateGoals(
            {
              weeklySessions: optionalNumber(f.get("weekly"), 1, 21),
              lessons: {
                ...expected.lessons,
                [id]: {
                  minutes: optionalNumber(f.get("minutes"), 1, 240),
                  bpm: optionalNumber(f.get("bpm"), 1, 400),
                },
              },
            },
            expected,
          );
        } catch (e) {
          setError(message(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>我的练习目标</h2>
      <p>{shortTitle(c.lesson(id))}</p>
      <label>
        每次练习分钟
        <input
          name="minutes"
          type="number"
          min="1"
          max="240"
          defaultValue={g?.minutes ?? ""}
        />
      </label>
      <label>
        每周总练习次数
        <input
          name="weekly"
          type="number"
          min="1"
          max="21"
          defaultValue={expected.weeklySessions ?? ""}
        />
      </label>
      <label>
        个人目标 BPM
        <input
          name="bpm"
          type="number"
          min="1"
          max="400"
          defaultValue={g?.bpm ?? ""}
        />
      </label>
      <p>个人目标不改变老师的练习要求。</p>
      <p id="goal-error" role="alert">
        {error}
      </p>
      <Button variant="primary" disabled={busy}>
        保存目标
      </Button>
    </form>
  );
}
function ResultForm({ record }: { record: PracticeLog }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      id="result-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        const f = new FormData(e.currentTarget);
        setBusy(true);
        try {
          await c.updateLog(
            {
              ...record,
              bpm: optionalNumber(f.get("bpm"), 1, 400),
              bpmBasis: "self-reported-stable",
              outcome: (f.get("outcome") || null) as Outcome | null,
              updatedAt: new Date().toISOString(),
            },
            record.updatedAt,
          );
          c.setDialog(null);
        } catch (e) {
          setError(message(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>修改本次结果</h2>
      <label>
        实际稳定 BPM · 选填
        <input
          name="bpm"
          type="number"
          min="1"
          max="400"
          defaultValue={record.bpm ?? ""}
        />
      </label>
      <label>
        熟练程度
        <select name="outcome" defaultValue={record.outcome ?? ""}>
          <option value="">未确认</option>
          {Object.entries(OUTCOMES).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <p id="result-error" role="alert">
        {error}
      </p>
      <Button variant="primary" disabled={busy}>
        保存修改
      </Button>
    </form>
  );
}
function Manage() {
  const s = usePractice();
  const [pending, setPending] = useState<Awaited<
      ReturnType<typeof c.previewBackup>
    > | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <section>
      <h2>备份与管理</h2>
      <p>记录仅保存在本机。</p>
      <Button data-action="export" onClick={() => c.run(c.exportBackup)}>
        导出备份
      </Button>
      <label className="import-control">
        导入备份
        <input
          id="import"
          type="file"
          accept="application/json"
          onChange={async (e) => {
            setPending(null);
            setError("");
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              setPending(await c.previewBackup(file));
            } catch (e) {
              setError(message(e));
            }
          }}
        />
      </label>
      <p role="alert">{error}</p>
      <div id="import-preview">
        {pending && (
          <>
            <p>
              新增 {pending.additions} 条，跳过 {pending.duplicates}{" "}
              条重复记录。
            </p>
            <Button
              data-action="import-confirm"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await c.restoreBackup(pending);
                } catch (e) {
                  setError(message(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              确认导入
            </Button>
          </>
        )}
      </div>
      <h3>记录管理</h3>
      {s.logs.map((l) => (
        <div key={l.id} className="manage-row">
          <span>
            {shortTitle(c.lesson(l.entryId))} · {clock(l.minutes * 60)}
          </span>
          <Button
            data-delete={l.id}
            onClick={() =>
              c.run(() =>
                c.updateLog(
                  {
                    ...l,
                    deletedAt: l.deletedAt ? null : new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  },
                  l.updatedAt,
                ),
              )
            }
          >
            {l.deletedAt ? "恢复" : "删除"}
          </Button>
        </div>
      ))}
      <h3>看课记录管理</h3>
      {s.watches.map((r) => (
        <div className="manage-row" key={r.id}>
          <span>
            {shortTitle(c.lesson(r.entryId))} · {clock(r.seconds)}
          </span>
          <Button
            data-watch-delete={r.id}
            onClick={() => c.run(() => c.deleteWatch(r))}
          >
            {r.deletedAt ? "恢复" : "删除"}
          </Button>
        </div>
      ))}
    </section>
  );
}
export function Catalog() {
  const s = usePractice();
  useLocation();
  const params = c.route().params,
    q = params.get("q") || "",
    kind = params.get("kind") || "all",
    stage = params.get("stage") || "all",
    legacy = params.get("legacy") === "1";
  const link = (changes: Record<string, string>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    return "#catalog?" + p;
  };
  const matches = filterEntries(s.course!, {
    query: q,
    includeLegacy: legacy,
  }).filter(
    (e) =>
      kind === "all" ||
      (kind === "other"
        ? !["lesson", "backing", "demo", "followAlong"].includes(e.kind)
        : e.kind === kind),
  );
  const entries = matches.filter(
      (e) => stage === "all" || e.stage === Number(stage),
    ),
    stages = [{ id: 0, title: "课程导览" }, ...STAGES];
  return (
    <>
      <div className="library-header">
        <h1>课程目录</h1>
        <span className="library-total">
          {s.course!.entries.filter((e) => legacy || !e.legacy).length}{" "}
          节课程与资料
        </span>
      </div>
      <div className="library-layout">
        <nav className="library-stages" aria-label="课程阶段">
          <a
            href={link({ stage: "" })}
            aria-current={stage === "all" ? "page" : undefined}
          >
            全部课程 <span>{matches.length}</span>
          </a>
          {stages.map((x) => (
            <a
              key={x.id}
              href={link({ stage: String(x.id) })}
              aria-current={stage === String(x.id) ? "page" : undefined}
            >
              {x.id ? `W${x.id} ` : ""}
              {x.title}
              <span>{matches.filter((e) => e.stage === x.id).length}</span>
            </a>
          ))}
        </nav>
        <section className="library-content">
          <form
            id="library-search"
            className="library-search"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              location.hash = link({ q: String(f.get("q") || "").trim() });
            }}
          >
            <svg className="icon" aria-hidden="true">
              <use href="#i-search" />
            </svg>
            <input
              key={q}
              name="q"
              type="search"
              defaultValue={q}
              placeholder="搜索课程、练习或歌曲"
              aria-label="搜索课程"
            />
            <Button>搜索</Button>
          </form>
          <div className="library-toolbar">
            <nav className="library-types">
              {[
                ["all", "全部"],
                ["lesson", "讲解"],
                ["backing", "伴奏"],
                ["demo", "示范"],
                ["followAlong", "跟练"],
                ["other", "其他"],
              ].map(([key, label]) => (
                <a
                  key={key}
                  href={link({ kind: key })}
                  aria-current={key === kind ? "page" : undefined}
                >
                  {label}
                </a>
              ))}
            </nav>
            <label className="library-legacy">
              <input
                id="library-legacy"
                type="checkbox"
                checked={legacy}
                onChange={(e) => {
                  location.hash = link({ legacy: e.target.checked ? "1" : "" });
                }}
              />
              包含旧版
            </label>
          </div>
          <div className="course-directory">
            {stages.map((x) => {
              const list = entries.filter((e) => e.stage === x.id);
              return list.length ? (
                <section key={x.id} className="library-group">
                  <header>
                    <h2>
                      {x.id ? `W${x.id} ` : ""}
                      {x.title}
                    </h2>
                    <span>{list.length} 节</span>
                  </header>
                  {list.map((e) => {
                    const content = (
                      <>
                        <span
                          className={`library-icon kind-${e.kind}`}
                          aria-hidden="true"
                        >
                          {KINDS[e.kind].slice(0, 1)}
                        </span>
                        <span className="library-row-text">
                          <strong>{shortTitle(e)}</strong>
                          <span className="library-meta">
                            P{String(e.page).padStart(3, "0")} · {KINDS[e.kind]}{" "}
                            · {clock(e.durationSeconds)}
                            {e.legacy ? " · 旧版" : ""}
                          </span>
                        </span>
                        <span className="library-row-action">
                          {e.kind === "lesson" ? "查看练习" : "查看资料"}
                        </span>
                      </>
                    );
                    return e.kind === "lesson" ? (
                      <a
                        className="directory-row directory-action"
                        key={e.id}
                        href={`#practice?stage=${e.stage}&lesson=${e.id}&view=lesson`}
                      >
                        {content}
                      </a>
                    ) : (
                      <Button
                        className="directory-row directory-action"
                        key={e.id}
                        data-material={e.id}
                        onClick={() =>
                          c.setDialog({ kind: "materials", id: e.id })
                        }
                      >
                        {content}
                      </Button>
                    );
                  })}
                </section>
              ) : null;
            })}
            {!entries.length && (
              <div className="library-empty">
                <h2>没有找到匹配的课程</h2>
                <a href="#catalog">清除筛选</a>
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
function Graph({
  points,
  tempo = false,
}: {
  points: ChartPoint[];
  tempo?: boolean;
}) {
  if (!points.length)
    return <p>还没有{tempo ? "确认过稳定 BPM" : "练习记录"}</p>;
  const coords = chartCoordinates(points, { zero: !tempo });
  return (
    <svg
      className={`review-chart ${tempo ? "tempo-chart" : "duration-chart"}`}
      viewBox="0 0 640 220"
      role="img"
      aria-label={
        tempo
          ? "逐次自评稳定 BPM，精确值见下方明细"
          : "累计练习时长，精确值见下方明细"
      }
    >
      <path className="chart-axis" d="M56 34V176H604" />
      {!tempo && (
        <polyline
          className="duration-path"
          points={coords
            .flatMap((p, i) =>
              i
                ? [`${p.x},${coords[i - 1].y}`, `${p.x},${p.y}`]
                : [`${p.x},${p.y}`],
            )
            .join(" ")}
        />
      )}
      <text x="56" y="20">
        {tempo ? "BPM" : "累计分钟"}
      </text>
      {coords.map((p) => (
        <circle key={p.id} cx={p.x} cy={p.y} r="4" className="observation">
          <title>
            {new Date(p.at).toLocaleString("zh-CN")} ·{" "}
            {tempo ? p.value : clock(p.value)}
          </title>
        </circle>
      ))}
      <text x="56" y="208">
        {new Date(points[0].at).toLocaleDateString("zh-CN")}
      </text>
      <text x="604" y="208" textAnchor="end">
        {new Date(points.at(-1)!.at).toLocaleDateString("zh-CN")}
      </text>
    </svg>
  );
}
export function History() {
  const s = usePractice();
  useLocation();
  const params = c.route().params,
    groups = reviewGroups(s.logs, s.assignments!.items),
    id = params.get("lesson"),
    versions = groups.filter((g) => g.entryId === id),
    group =
      versions.find((g) => g.version === params.get("version")) ||
      (!params.has("version")
        ? versions.find((g) => g.current) || versions[0]
        : undefined),
    record = activeLogs(s.logs).find((l) => l.id === params.get("session"));
  const link = (version: string, extra: Record<string, string> = {}) =>
    "#history?" + new URLSearchParams({ lesson: id!, version, ...extra });
  const filter = params.get("review") || "all";
  return (
    <>
      <div className="page-heading">
        <h1>练习回顾</h1>
        <Button
          data-action="manage"
          disabled={!s.ready}
          onClick={() => c.setDialog({ kind: "manage" })}
        >
          备份与管理
        </Button>
      </div>
      {record && (
        <section className="completion">
          <h2>本次练习已记录</h2>
          <p>
            {clock(record.minutes * 60)} ·{" "}
            {shortTitle(c.lesson(record.entryId))}
          </p>
          <p>
            {record.bpm === null ? "未确认 BPM" : `${record.bpm} BPM`} ·{" "}
            {record.outcome ? OUTCOMES[record.outcome] : "未评价"}
          </p>
          {record.note && <p>{record.note}</p>}
          {record.nextFocus && <p>下次重点：{record.nextFocus}</p>}
          {!!record.tempoUsage?.length && (
            <details>
              <summary>节拍器使用记录</summary>
              {record.tempoUsage.map((x) => (
                <p key={x.bpm}>
                  {x.bpm} BPM · {clock(x.seconds)}
                </p>
              ))}
            </details>
          )}
          <Button
            data-edit-result={record.id}
            onClick={() => c.setDialog({ kind: "result", record })}
          >
            修改本次结果
          </Button>
        </section>
      )}
      {id ? (
        group ? (
          <section className="lesson-review" data-review-lesson={id}>
            <a href="#history">全部课程</a>
            <h2>{shortTitle(c.lesson(id))}</h2>
            <a className="button primary" href={`#practice?lesson=${id}`}>
              返回练习台
            </a>
            <label>
              练习版本
              <select
                id="review-version"
                value={link(group.version)}
                onChange={(e) => {
                  location.hash = e.target.value;
                }}
              >
                {versions.map((v) => (
                  <option key={v.version} value={link(v.version)}>
                    {v.current ? "当前要求" : "历史要求"} · {v.version}
                  </option>
                ))}
              </select>
            </label>
            <div className="lesson-metrics">
              <strong>
                累计 {clock(group.seconds)} · {group.records.length} 次
              </strong>
              <span>
                {group.latestTempo
                  ? `${group.latestTempo.value} BPM`
                  : "未确认 BPM"}
              </span>
              <span>
                {group.latestOutcome
                  ? OUTCOMES[group.latestOutcome.value!]
                  : "未评价"}
              </span>
            </div>
            <div className="lesson-charts">
              <section>
                <h3>累计练习时长</h3>
                <Graph points={group.duration} />
              </section>
              <section>
                <h3>自评稳定 BPM</h3>
                <p>逐次记录；练习段落未区分，不推算提速幅度。</p>
                <Graph points={group.tempo} tempo />
              </section>
            </div>
            <h3>熟练程度变化 · 最近在前</h3>
            <ol className="proficiency-timeline">
              {[...group.outcomes].reverse().map((p) => (
                <li key={p.id}>
                  <a href={link(group.version, { session: p.id })}>
                    {OUTCOMES[p.value!]} ·{" "}
                    {new Date(p.at).toLocaleDateString("zh-CN")}
                  </a>
                </li>
              ))}
            </ol>
            <RecordTable
              group={group}
              page={Number(params.get("records")) || 1}
              link={link}
            />
          </section>
        ) : (
          <p>
            这个版本还没有练习记录 <a href="#history">返回全部课程</a>
          </p>
        )
      ) : (
        <>
          <EffortReview />
          <section className="lesson-review">
            <h2>每课进展</h2>
            <nav className="review-filters">
              {[
                ["all", "全部"],
                ["continue", "继续练"],
                ["mastered", "已掌握"],
                ["unrated", "未评价"],
              ].map(([key, label]) => (
                <a
                  key={key}
                  className="button secondary"
                  href={`#history?review=${key}`}
                  aria-current={filter === key ? "page" : undefined}
                >
                  {label}
                </a>
              ))}
            </nav>
            <div className="lesson-progress-list">
              {groups
                .filter((g) => filter === "all" || g.status === filter)
                .map((g) => (
                  <article
                    className="lesson-progress-row"
                    data-review-group={g.key}
                    key={g.key}
                  >
                    <div>
                      <h3>{shortTitle(c.lesson(g.entryId))}</h3>
                      <p>
                        {g.current ? "当前要求" : `历史要求 · ${g.version}`}
                      </p>
                      <p>
                        {g.latestOutcome
                          ? OUTCOMES[g.latestOutcome.value!]
                          : "未评价"}
                      </p>
                    </div>
                    <strong>
                      {clock(g.seconds)} · {g.records.length} 次
                    </strong>
                    <span>
                      {g.latestTempo
                        ? `${g.latestTempo.value} BPM`
                        : "未确认 BPM"}
                    </span>
                    <a
                      className="button secondary"
                      href={`#history?lesson=${g.entryId}&version=${g.version}`}
                    >
                      查看变化
                    </a>
                  </article>
                ))}
            </div>
            {!groups.length && <p>完成第一次练习后，这里会展示每课的变化。</p>}
          </section>
        </>
      )}
      <section className="study-history">
        <h2>看课时间</h2>
        <p>
          累计 {clock(totalWatchSeconds(s.watches, id || undefined))} · 单独记录
        </p>
        {s.watches
          .filter((r) => !r.deletedAt && (!id || r.entryId === id))
          .map((r) => (
            <div className="session-row" key={r.id}>
              <span>
                {new Date(r.startedAt).toLocaleString("zh-CN")} ·{" "}
                {shortTitle(c.lesson(r.entryId))}
              </span>
              <strong>{clock(r.seconds)}</strong>
            </div>
          ))}
      </section>
    </>
  );
}
function RecordTable({
  group,
  page,
  link,
}: {
  group: ReturnType<typeof reviewGroups>[number];
  page: number;
  link: (version: string, extra?: Record<string, string>) => string;
}) {
  const count = Math.ceil(group.records.length / 20),
    current = Math.max(1, Math.min(count, page)),
    rows = [...group.records].reverse().slice((current - 1) * 20, current * 20),
    cumulative = new Map(group.duration.map((p) => [p.id, p.value]));
  return (
    <section className="lesson-records">
      <h3>每次练习</h3>
      <div className="record-table-scroll">
        <table>
          <caption>练习明细 · {group.records.length} 次</caption>
          <thead>
            <tr>
              {["日期", "时长", "累计时长", "稳定 BPM", "熟练程度", "记录"].map(
                (x) => (
                  <th key={x} scope="col">
                    {x}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.practicedAt).toLocaleString("zh-CN")}</td>
                <td>{clock(r.minutes * 60)}</td>
                <td>{clock(cumulative.get(r.id)!)}</td>
                <td>
                  {r.bpmBasis === "self-reported-stable" && r.bpm !== null
                    ? r.bpm
                    : "未确认"}
                </td>
                <td>{r.outcome ? OUTCOMES[r.outcome] : "未评价"}</td>
                <td>
                  <a
                    href={link(group.version, {
                      session: r.id,
                      records: String(current),
                    })}
                  >
                    查看
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {count > 1 && (
        <nav className="review-pagination">
          {current > 1 && (
            <a href={link(group.version, { records: String(current - 1) })}>
              上一页
            </a>
          )}
          <span>
            {current} / {count}
          </span>
          {current < count && (
            <a href={link(group.version, { records: String(current + 1) })}>
              下一页
            </a>
          )}
        </nav>
      )}
    </section>
  );
}
