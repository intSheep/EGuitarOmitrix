import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import * as c from "../controllers/practice";
import { usePractice, clock, Requirements } from "./common";
import { Button } from "./ui/button";
import { STAGES, primaryLessons, shortTitle } from "../domain/course";
import {
  resumeGuidance,
  FINISH_OUTCOMES,
  optionalNumber,
} from "../domain/guidance";
import { teacherPrescription } from "../domain/prescription";
import { OUTCOMES } from "../storage/practice-store";
import { message, type Outcome } from "../domain/types";
import { showScore, closeScore } from "../../app/score-viewer.js";
import { showTuner, closeTuner } from "../../app/tuner.js";
import {
  showPositionReference,
  closePositionReference,
} from "../../app/position-reference.js";
import { Materials } from "./records";
import { PitchStage } from "./pitch-stage";
import {
  startPitchCapture,
  stopPitchCapture,
  subscribePitchFrames,
} from "../audio/pitch-capture";
import { playReferenceMidi } from "../audio/reference-tone";

const toolIcons: Record<Exclude<c.Tool, null>, ReactNode> = {
  tuner: (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
      <path d="M9 3v8a3 3 0 0 0 6 0V3M12 14v7M7 3v7m10-7v7" />
    </svg>
  ),
  position: (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M9 3v18m6-18v18M4 9h16M4 15h16" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  ),
  score: (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
      <path d="M9 17V5l11-2v12M9 8l11-2" />
      <ellipse cx="6" cy="17" rx="3" ry="2" />
      <ellipse cx="17" cy="15" rx="3" ry="2" />
    </svg>
  ),
  metronome: (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
      <path d="M9 3h6l5 18H4L9 3ZM12 16l5-10M8 17h8" />
    </svg>
  ),
  materials: (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
      <rect x="3" y="5" width="18" height="15" rx="2" />
      <path d="m10 9 5 3-5 3V9ZM7 2v3m10-3v3" />
    </svg>
  ),
};

const dialTicks = Array.from({ length: 60 }, (_, i) => {
  const major = i % 5 === 0;
  return (
    <line
      key={i}
      x1="140"
      y1={major ? "10" : "14"}
      x2="140"
      y2={major ? "22" : "19"}
      stroke={major ? "#94a3b8" : "#dce3f0"}
      strokeWidth={major ? "2.4" : "1.4"}
      strokeLinecap="round"
      transform={`rotate(${i * 6} 140 140)`}
    />
  );
});

export function Workspace() {
  const s = usePractice();
  useLocation();
  const [pitchPlaygroundOpen, setPitchPlaygroundOpen] = useState(false);
  useEffect(() => () => stopPitchCapture(), []);
  let e = c.selected();
  const params = c.route().params,
    requested = Number(params.get("stage"));
  const stage = STAGES.some((x) => x.id === requested)
    ? requested
    : e.stage || 1;
  const lessons = primaryLessons(s.course!, stage);
  if (e.legacy && e.stage === stage) lessons.push(e);
  if (e.stage !== stage || e.kind !== "lesson") e = lessons[0];
  const g = resumeGuidance(
    s.logs,
    e.id,
    c.assignment(e.id)?.version || s.assignments!.version,
    c.assignment(e.id),
  );
  const target = s.draft?.entryId || e.id;
  const currentStage = STAGES.find((x) => x.id === stage)!;
  const showPlayground = pitchPlaygroundOpen && s.tool !== "tuner";
  return (
    <>
      <div className="page-heading">
        <h1>练习台</h1>
        <div className="workspace-quick-tools">
          <Button
            data-action="workspace-pitch"
            onClick={() => {
              if (s.tool) c.setTool(null);
              setPitchPlaygroundOpen(true);
              void startPitchCapture();
            }}
          >
            {pitchToolIcon}
            <span>实时音高</span>
          </Button>
          <Button
            data-tuner
            onClick={() => {
              setPitchPlaygroundOpen(false);
              stopPitchCapture();
              c.run(() => c.openTool("tuner"));
            }}
          >
            {toolIcons.tuner}
            <span>调音器</span>
          </Button>
        </div>
      </div>
      {s.saved && (
        <div className="saved-feedback" role="status">
          已保存 · {clock(s.saved.minutes * 60)}{" "}
          <a href={`#history?lesson=${s.saved.entryId}&session=${s.saved.id}`}>
            查看记录
          </a>
        </div>
      )}
      <div className="stage-pills" role="navigation" aria-label="课程周次">
        {STAGES.map((x) => (
          <a
            key={x.id}
            className="button secondary"
            aria-current={x.id === stage ? "step" : undefined}
            href={`#practice?stage=${x.id}&lesson=${primaryLessons(s.course!, x.id)[0].id}&view=list`}
          >
            <span>W{x.id}</span>
            {x.id === stage && (
              <small className="stage-pill-title">· {x.title}</small>
            )}
          </a>
        ))}
      </div>
      <div className="practice-layout">
        <section className="exercise-list">
          <div className="list-heading">
            <h2>
              {currentStage.title}
              <span>{lessons.length} 课</span>
            </h2>
          </div>
          <ul>
            {lessons.map((l) => {
              const logs = s.logs.filter(
                (x) => !x.deletedAt && x.entryId === l.id,
              );
              const lp = teacherPrescription(c.assignment(l.id));
              return (
                <li
                  key={l.id}
                  className={`exercise-row ${l.id === e.id ? "is-selected" : ""}`}
                >
                  <a
                    className="exercise-select"
                    href={`#practice?stage=${stage}&lesson=${l.id}&view=lesson`}
                  >
                    <span className="exercise-number">
                      {String(l.exercises[0]).padStart(2, "0")}
                    </span>
                    <span className="exercise-label">
                      <strong>{shortTitle(l)}</strong>
                      <span>
                        {lp.dailyMinutes !== null
                          ? `每天 ${lp.dailyMinutes} 分钟 · `
                          : ""}
                        {logs.length
                          ? `累计 ${clock(logs.reduce((n, x) => n + x.minutes * 60, 0))}`
                          : "尚未练习"}
                      </span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
        <aside className="lesson-detail">
          <Button
            className="client-back"
            onClick={() =>
              c.navigate(`practice?stage=${stage}&lesson=${e.id}&view=list`)
            }
          >
            返回课程列表
          </Button>
          <div className="client-lesson-content">
            <div className="detail-hero">
              <div className="detail-hero-copy">
                <span className="detail-badge">
                  W{e.stage} · EX{e.exercises[0]} · P
                  {String(e.page).padStart(3, "0")}
                </span>
                <h2>{shortTitle(e)}</h2>
              </div>
              <img className="detail-art" src="./assets/fretboard.svg" alt="" />
            </div>
            <Requirements id={e.id} />
            {g.last && (
              <section className="resume-panel">
                <h3>{g.action}</h3>
                <p>
                  上次 {clock(g.last.minutes * 60)}
                  {g.last.bpm
                    ? ` · ${g.last.bpmBasis === "self-reported-stable" ? "稳定" : "记录速度"} ${g.last.bpm} BPM`
                    : ""}
                  {g.last.outcome ? ` · ${OUTCOMES[g.last.outcome]}` : ""}
                </p>
              </section>
            )}
            <div className="goal-bar">
              <span className="goal-label">我的练习目标</span>
              <Button
                variant="link"
                data-goals={e.id}
                disabled={!s.ready}
                onClick={() => c.setDialog({ kind: "goals", id: e.id })}
              >
                设置目标
              </Button>
            </div>
          </div>
          <div className="client-lesson-actions">
            <div className="single-start">
              <Button
                variant="primary"
                className="wide"
                data-start={target}
                disabled={!s.ready || s.busy}
                onClick={() =>
                  c.run(() =>
                    s.draft?.running ? c.navigate("focus") : c.start(target),
                  )
                }
              >
                {s.draft
                  ? s.draft.finishing
                    ? "确认上次练习"
                    : s.draft.running
                      ? "返回练习"
                      : "继续未结束的练习"
                  : g.last
                    ? "接着练"
                    : "开始练习"}
                {s.draft && s.draft.entryId !== e.id
                  ? ` · ${shortTitle(c.lesson(s.draft.entryId))}`
                  : ""}
              </Button>
            </div>
            <Button
              className="wide"
              data-material={e.id}
              onClick={() => c.setDialog({ kind: "materials", id: e.id })}
            >
              {toolIcons.materials}
              <span>课程资料</span>
            </Button>
          </div>
        </aside>
      </div>
      {s.tool === "tuner" && <ToolSurface tool="tuner" id={e.id} standalone />}
      {showPlayground && (
        <PitchPlaygroundDialog
          onClose={() => {
            stopPitchCapture();
            setPitchPlaygroundOpen(false);
          }}
        />
      )}
    </>
  );
}
function PitchPlaygroundDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const handleClose = () => onCloseRef.current();
    dialog.addEventListener("close", handleClose);
    return () => {
      dialog.removeEventListener("close", handleClose);
      if (dialog.open) dialog.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      id="pitch-playground-dialog"
      className="pitch-modal-dialog"
      aria-label="实时音高"
    >
      <PitchStage standalone onClose={onClose} />
    </dialog>
  );
}
const pitchToolIcon = (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
    <path d="M4 12h2l2-5 3 10 3-8 2 5 2-2h2" />
  </svg>
);

const tools: [Exclude<c.Tool, null>, string][] = [
  ["tuner", "调音器"],
  ["position", "把位速查"],
  ["score", "乐谱"],
  ["metronome", "节拍器"],
  ["materials", "课程资料"],
];
export function Focus() {
  const s = usePractice(),
    d = s.draft;
  const [pitchOpen, setPitchOpen] = useState(false);
  useEffect(() => () => stopPitchCapture(), []);
  if (!d)
    return (
      <>
        <h1>选择一个练习开始</h1>
        <a href="#practice">返回练习台</a>
      </>
    );
  const e = c.lesson(d.entryId),
    p = teacherPrescription(c.assignment(e.id));
  const showPitchStage = pitchOpen && s.tool !== "tuner";
  const splitPitch = showPitchStage && !!s.tool;
  return (
    <section
      className={`focus-page ${s.tool ? "has-focus-tool" : ""} ${showPitchStage ? "has-pitch-stage" : ""} ${splitPitch ? "has-pitch-split" : ""}`.trim()}
      data-active-tool={s.tool || undefined}
    >
      <div className="focus-top">
        <div className="focus-top-left">
          <div className="focus-course">
            <span>
              W{e.stage} · EX{e.exercises[0]}
            </span>
            <h1>{shortTitle(e)}</h1>
          </div>
        </div>
        <div className="focus-top-actions">
          {s.tool && (
            <Button id="focus-back" onClick={() => c.setTool(null)}>
              ← 返回计时
            </Button>
          )}
          <Button
            className="practice-menu-toggle"
            data-action="practice-menu"
            aria-expanded={s.dialog?.kind === "menu"}
            onClick={() => c.setDialog({ kind: "menu" })}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span>菜单</span>
          </Button>
        </div>
      </div>
      <div className="tool-dock" aria-label="练习工具">
        {tools
          .filter(([key]) => key !== "metronome" || !p.noMetronome)
          .map(([key, label]) => (
            <Button
              key={key}
              className="focus-tool"
              aria-label={label}
              aria-pressed={s.tool === key}
              data-playing={
                key === "metronome" && s.metroPlaying ? "true" : undefined
              }
              {...(key === "score"
                ? { "data-score": e.id }
                : key === "materials"
                  ? { "data-material": e.id }
                  : key === "position"
                    ? { "data-position-reference": "" }
                    : key === "tuner"
                      ? { "data-tuner": "" }
                      : { "data-action": "metronome" })}
              onClick={() => {
                if (key === "tuner") {
                  setPitchOpen(false);
                  stopPitchCapture();
                }
                c.run(() => c.openTool(key));
              }}
            >
              {toolIcons[key]}
              <span>{label}</span>
              {key === "metronome" && s.metroPlaying && (
                <span className="tool-live-badge" aria-hidden="true">
                  {s.metroBpm ? `${s.metroBpm}` : "●"}
                </span>
              )}
            </Button>
          ))}
        <Button
          className="focus-tool focus-tool-pitch"
          data-action="pitch-toggle"
          aria-pressed={showPitchStage}
          onClick={() => {
            if (showPitchStage) {
              setPitchOpen(false);
              stopPitchCapture();
            } else {
              if (s.tool === "tuner") c.setTool(null);
              setPitchOpen(true);
              void startPitchCapture();
            }
          }}
        >
          {pitchToolIcon}
          <span>实时音高</span>
        </Button>
      </div>
      <div className="focus-main">
        {!showPitchStage && (
          <div
            id="focus-clock"
            className={d.running ? "clock-running" : ""}
            hidden={!!s.tool}
          >
            <div className="timer-orbit">
              <div className="ambient-orbit" />
              <svg
                className="timer-dial"
                viewBox="0 0 280 280"
                aria-hidden="true"
              >
                <circle
                  cx="140"
                  cy="140"
                  r="134"
                  fill="none"
                  stroke="#e2e8f0"
                  strokeWidth="2"
                />
                {dialTicks}
              </svg>
              <div className="timer-content">
                <p id="timer-state" role="status">
                  {d.running ? "练习中" : d.reason || "已暂停"}
                </p>
                <strong id="timer-value" role="timer" aria-label="练习时间">
                  {clock(d.elapsedMs / 1000)}
                </strong>
                <span>练习时间</span>
              </div>
            </div>
            <div className="pitch-launch-row">
              <Button
                className="pitch-launch-btn"
                data-action="pitch-open"
                onClick={() => {
                  setPitchOpen(true);
                  void startPitchCapture();
                }}
              >
                {pitchToolIcon}
                <span>开启实时音高</span>
              </Button>
            </div>
            <div id="focus-requirements">
              <Requirements id={e.id} />
            </div>
          </div>
        )}
        {s.tool && <ToolSurface tool={s.tool} id={e.id} />}
        {showPitchStage && (
          <div
            id={!s.tool ? "focus-clock" : undefined}
            className={`${!s.tool && d.running ? "clock-running" : ""} ${splitPitch ? "pitch-pane" : ""}`.trim()}
            data-pitch-stage="true"
          >
            <PitchStage
              running={d.running}
              reason={d.reason}
              elapsedMs={d.elapsedMs}
              embedded={splitPitch}
              onClose={() => {
                stopPitchCapture();
                setPitchOpen(false);
              }}
            />
          </div>
        )}
      </div>
      <div className="focus-actions">
        {s.tool && (
          <span className="passive-clock">
            <span data-session-time role="timer">
              {clock(d.elapsedMs / 1000)}
            </span>{" "}
            · {d.running ? "练习中" : "已暂停"}
          </span>
        )}
        <Button
          data-action="pause"
          disabled={s.busy}
          onClick={() =>
            c.run(() => (d.running ? c.pause() : c.start(d.entryId)))
          }
        >
          {d.running ? "暂停练习" : "继续练习"}
        </Button>
        <Button
          variant="primary"
          data-action="finish"
          disabled={s.busy}
          onClick={() => c.run(c.finish)}
        >
          结束练习
        </Button>
      </div>
    </section>
  );
}
function ToolSurface({
  tool,
  id,
  standalone = false,
}: {
  tool: c.Tool;
  id: string;
  standalone?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const trigger = document.activeElement as HTMLElement | null;
    const onClose = () => c.setTool(null);
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector("dialog:modal")) {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", escape);
    if (tool === "score")
      c.run(() =>
        showScore(id, shortTitle(c.lesson(id)), {
          host,
          onClose,
          onPlayStart: () => c.stopMetronome(),
        }),
      );
    if (tool === "tuner")
      showTuner({ host: standalone ? null : host, onClose });
    if (tool === "position")
      showPositionReference({
        host,
        onClose,
        subscribePitchFrames,
        playReferenceMidi,
      });
    const dialog = standalone ? document.querySelector("#tuner-dialog") : null;
    dialog?.addEventListener("close", onClose);
    host.tabIndex = -1;
    if (!standalone) host.focus({ preventScroll: true });
    return () => {
      document.removeEventListener("keydown", escape);
      dialog?.removeEventListener("close", onClose);
      if (tool === "score") closeScore();
      if (tool === "tuner") closeTuner();
      if (tool === "position") closePositionReference();
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [tool, id, standalone]);
  return (
    <div id="focus-tool-content" data-tool={tool} ref={ref}>
      {tool === "metronome" ? (
        <MetronomePanel id={id} />
      ) : tool === "materials" ? (
        <Materials id={id} />
      ) : null}
    </div>
  );
}
function MetronomePanel({ id }: { id: string }) {
  const s = usePractice(),
    p = teacherPrescription(c.assignment(id)),
    g = resumeGuidance(
      s.logs,
      id,
      c.assignment(id)?.version || "",
      c.assignment(id),
    );
  const [bpm, setBpm] = useState(
    s.metroPlaying && s.metroBpm ? s.metroBpm : g.bpm || p.startBpm || 60,
  );
  return (
    <section id="metro-panel">
      <h2>节拍器</h2>
      <p>{p.tempo}</p>
      <label>
        BPM
        <input
          id="bpm"
          type="number"
          min="20"
          max="300"
          value={bpm}
          disabled={!!p.fixedBpm}
          onChange={(e) => {
            c.stopMetronome();
            setBpm(Number(e.target.value));
          }}
        />
      </label>
      <div className="beats">
        {[0, 1, 2, 3].map((i) => (
          <i className="beat-dot" key={i} />
        ))}
      </div>
      <Button
        data-action="metro-toggle"
        onClick={() => c.run(() => c.toggleMetronome(bpm))}
      >
        {s.metroPlaying ? "停止节拍" : "播放节拍"}
      </Button>
    </section>
  );
}
export function Finish() {
  const s = usePractice(),
    d = s.draft;
  const [bpm, setBpm] = useState(String(d?.review?.bpm ?? "")),
    [outcome, setOutcome] = useState<Outcome | null>(
      d?.review?.outcome ?? null,
    ),
    [error, setError] = useState("");
  if (!d) return <a href="#practice">返回练习台</a>;
  const changed = (b: string, o: Outcome | null) => {
    setBpm(b);
    setOutcome(o);
    void c.updateReview(b, o).catch((e) => setError(message(e)));
  };
  return (
    <section className="finish-page">
      <h1>收好这次练习</h1>
      <p>{shortTitle(c.lesson(d.entryId))}</p>
      <div className="finish-time">
        <strong>{clock(d.elapsedMs / 1000)}</strong>
        <span>练习时间</span>
      </div>
      <form
        id="finish-form"
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          void Promise.resolve()
            .then(() => c.saveResult(optionalNumber(bpm, 1, 400), outcome))
            .catch((e) => setError(message(e)));
        }}
      >
        <div className="finish-inputs">
          <label htmlFor="stable-bpm">实际稳定 BPM · 选填</label>
          <input
            id="stable-bpm"
            name="bpm"
            type="number"
            min="1"
            max="400"
            value={bpm}
            disabled={s.busy}
            placeholder="未确认可留空"
            onChange={(e) => changed(e.target.value, outcome)}
          />
          <fieldset className="finish-outcomes" disabled={s.busy}>
            <legend>这次练得怎么样 · 选填</legend>
            {Object.entries(FINISH_OUTCOMES).map(([key, label]) => (
              <label key={key}>
                <input
                  type="radio"
                  name="outcome"
                  value={key}
                  checked={outcome === key}
                  onChange={() => changed(bpm, key as Outcome)}
                />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>
          <p id="finish-error" role="alert">
            {error}
          </p>
        </div>
        <div className="finish-actions">
          <Button variant="primary" type="submit" disabled={s.busy}>
            {s.busy ? "正在保存…" : "保存结果"}
          </Button>
          <Button
            type="button"
            data-action="resume-finish"
            disabled={s.busy}
            onClick={() => c.run(() => c.start(d.entryId, true))}
          >
            返回练习
          </Button>
          <Button
            type="button"
            className="finish-discard"
            data-action="discard-finish"
            disabled={s.busy}
            onClick={() => c.run(c.discard)}
          >
            放弃本次练习
          </Button>
        </div>
      </form>
    </section>
  );
}
