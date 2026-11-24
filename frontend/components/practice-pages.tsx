import { useEffect, useRef, useState } from "react";
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
import { attachLightDismiss } from "../platform/dialog-utils";
import { PitchStage } from "./pitch-stage";
import {
  startPitchCapture,
  stopPitchCapture,
  subscribePitchFrames,
} from "../audio/pitch-capture";
import { playReferenceMidi } from "../audio/reference-tone";

const viewIcons = {
  timer: (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  score: (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
      <path d="M9 17V5l11-2v12M9 8l11-2" />
      <ellipse cx="6" cy="17" rx="3" ry="2" />
      <ellipse cx="17" cy="15" rx="3" ry="2" />
    </svg>
  ),
  pitch: (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
      <path d="M4 12h2l2-5 3 10 3-8 2 5 2-2h2" />
    </svg>
  ),
  split: (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M12 4v16M6 10h3m-3 4h3m6-2h3" />
    </svg>
  ),
};

const utilityIcons = {
  metronome: (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
      <path d="M9 3h6l5 18H4L9 3ZM12 16l5-10M8 17h8" />
    </svg>
  ),
  position: (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M9 3v18m6-18v18M4 9h16M4 15h16" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  ),
  tuner: (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
      <path d="M9 3v8a3 3 0 0 0 6 0V3M12 14v7M7 3v7m10-7v7" />
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
  const pitchOpenRef = useRef(false);
  pitchOpenRef.current = pitchPlaygroundOpen;
  useEffect(
    () => () => {
      if (pitchOpenRef.current) stopPitchCapture();
    },
    [],
  );
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
  const showPlayground =
    pitchPlaygroundOpen && !s.tunerOpen && !s.positionOpen;
  const runningPrescription = s.draft?.running
    ? teacherPrescription(c.assignment(s.draft.entryId))
    : null;
  const toolbarProps = { focusgroup: "toolbar wrap" } as Record<
    string,
    string
  >;
  return (
    <>
      <div className="page-heading">
        <h1>练习台</h1>
        <div
          className="workspace-quick-tools"
          role="toolbar"
          aria-label="快捷工具"
          {...toolbarProps}
        >
          <Button
            data-action="workspace-pitch"
            onClick={() => {
              if (s.tunerOpen) c.closeTunerOverlay();
              if (s.positionOpen) c.setPositionOpen(false);
              setPitchPlaygroundOpen(true);
              void startPitchCapture();
            }}
          >
            {viewIcons.pitch}
            <span>实时识音</span>
          </Button>
          <span
            className="toolbar-divider"
            role="separator"
            aria-orientation="vertical"
          />
          <div
            className="workspace-utility-group"
            role="group"
            aria-label="小工具"
          >
            {!runningPrescription?.noMetronome && (
              <Button
                data-action="metronome"
                aria-pressed={s.metroOpen}
                data-playing={s.metroPlaying ? "true" : undefined}
                onClick={() => c.toggleMetroOpen()}
              >
                {utilityIcons.metronome}
                <span>节拍器</span>
                {s.metroPlaying && (
                  <span className="tool-live-badge" aria-hidden="true">
                    {s.metroBpm ?? "●"}
                  </span>
                )}
              </Button>
            )}
            <Button
              data-position-reference=""
              aria-pressed={s.positionOpen}
              onClick={() => {
                setPitchPlaygroundOpen(false);
                stopPitchCapture();
                if (s.tunerOpen) c.closeTunerOverlay();
                c.togglePosition();
              }}
            >
              {utilityIcons.position}
              <span>把位图</span>
            </Button>
            <Button
              data-tuner=""
              aria-pressed={s.tunerOpen}
              onClick={() => {
                setPitchPlaygroundOpen(false);
                stopPitchCapture();
                if (s.positionOpen) c.setPositionOpen(false);
                if (s.tunerOpen) c.closeTunerOverlay();
                else c.openTuner();
              }}
            >
              {utilityIcons.tuner}
              <span>调音器</span>
            </Button>
          </div>
        </div>
      </div>
      {s.metroOpen && !runningPrescription?.noMetronome && (
        <MetronomeBar
          id={s.draft?.running ? s.draft.entryId : undefined}
        />
      )}
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
              {utilityIcons.materials}
              <span>课程资料</span>
            </Button>
          </div>
        </aside>
      </div>
      {s.tunerOpen && <TunerHost standalone />}
      {s.positionOpen && <PositionHost standalone />}
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
    const detach = attachLightDismiss(dialog);
    if (!dialog.open) dialog.showModal();
    const handleClose = () => onCloseRef.current();
    dialog.addEventListener("close", handleClose);
    return () => {
      detach();
      dialog.removeEventListener("close", handleClose);
      if (dialog.open) dialog.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      id="pitch-playground-dialog"
      className="pitch-modal-dialog"
      aria-label="实时识音"
    >
      <PitchStage standalone onClose={onClose} />
    </dialog>
  );
}

export function Focus() {
  const s = usePractice(),
    d = s.draft;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || document.querySelector("dialog:modal")) {
        return;
      }
      const snap = c.getSnapshot();
      if (snap.tunerOpen) {
        event.preventDefault();
        c.closeTunerOverlay();
      } else if (snap.positionOpen) {
        event.preventDefault();
        c.setPositionOpen(false);
      } else if (snap.metroOpen) {
        event.preventDefault();
        c.setMetroOpen(false);
      } else if (snap.focusView !== "timer") {
        event.preventDefault();
        c.returnToTimer();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      stopPitchCapture();
    };
  }, []);
  if (!d)
    return (
      <>
        <h1>选择一个练习开始</h1>
        <a href="#practice">返回练习台</a>
      </>
    );
  const e = c.lesson(d.entryId),
    p = teacherPrescription(c.assignment(e.id));
  const showScorePane =
    s.focusView === "score" || s.focusView === "score-pitch";
  const showPitchPane =
    s.focusView === "pitch" || s.focusView === "score-pitch";
  const showClockPane = s.focusView === "timer";
  const awayFromTimer =
    s.focusView !== "timer" || s.tunerOpen || s.positionOpen;
  const toolbarProps = { focusgroup: "toolbar wrap" } as Record<
    string,
    string
  >;
  const pageClasses = [
    "focus-page",
    `focus-view-${s.focusView}`,
    s.focusView !== "timer" ? "has-focus-tool" : "",
    showPitchPane ? "has-pitch-stage" : "",
    s.focusView === "score-pitch" ? "has-pitch-split" : "",
    s.metroOpen && !p.noMetronome ? "has-metronome-bar" : "",
    s.positionOpen ? "has-position-drawer" : "",
    s.tunerOpen ? "has-tuner-overlay" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={pageClasses} data-focus-view={s.focusView}>
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
          {awayFromTimer && (
            <Button id="focus-back" onClick={() => c.returnToTimer()}>
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

      <div
        className="focus-toolbar"
        role="toolbar"
        aria-label="练习工作区"
        {...toolbarProps}
      >
        <div
          className="focus-primary-views"
          role="group"
          aria-label="主视图"
        >
          <Button
            className="focus-view-btn"
            data-view="timer"
            aria-pressed={s.focusView === "timer" && !s.tunerOpen}
            onClick={() => c.returnToTimer()}
          >
            {viewIcons.timer}
            <span>计时</span>
            {(s.focusView !== "timer" || s.tunerOpen) && (
              <span
                className="view-timer-badge"
                data-running={d.running ? "true" : "false"}
              >
                {clock(d.elapsedMs / 1000)}
              </span>
            )}
          </Button>
          <Button
            className="focus-view-btn"
            data-score={e.id}
            data-view="score"
            aria-pressed={s.focusView === "score" && !s.tunerOpen}
            onClick={() => c.setFocusView("score")}
          >
            {viewIcons.score}
            <span>乐谱</span>
          </Button>
          <Button
            className="focus-view-btn"
            data-action="pitch-toggle"
            data-view="pitch"
            aria-pressed={s.focusView === "pitch" && !s.tunerOpen}
            onClick={() => c.setFocusView("pitch")}
          >
            {viewIcons.pitch}
            <span>实时识音</span>
          </Button>
          <Button
            className="focus-view-btn"
            data-action="split-view"
            data-view="score-pitch"
            aria-pressed={s.focusView === "score-pitch" && !s.tunerOpen}
            title="边看谱边看实时识音"
            onClick={() => c.setFocusView("score-pitch")}
          >
            {viewIcons.split}
            <span>谱+识音</span>
          </Button>
        </div>

        <span
          className="toolbar-divider"
          role="separator"
          aria-orientation="vertical"
        />

        <div
          className="focus-utility-tools"
          role="group"
          aria-label="小工具"
        >
          {!p.noMetronome && (
            <Button
              className="focus-tool"
              data-action="metronome"
              aria-pressed={s.metroOpen}
              data-playing={s.metroPlaying ? "true" : undefined}
              onClick={() => c.toggleMetroOpen()}
            >
              {utilityIcons.metronome}
              <span>节拍器</span>
              {s.metroPlaying && (
                <span className="tool-live-badge" aria-hidden="true">
                  {s.metroBpm ?? "●"}
                </span>
              )}
            </Button>
          )}
          <Button
            className="focus-tool"
            data-position-reference=""
            aria-pressed={s.positionOpen}
            onClick={() => c.togglePosition()}
          >
            {utilityIcons.position}
            <span>把位图</span>
          </Button>
          <Button
            className="focus-tool"
            data-tuner=""
            aria-pressed={s.tunerOpen}
            onClick={() =>
              s.tunerOpen ? c.closeTunerOverlay() : c.openTuner()
            }
          >
            {utilityIcons.tuner}
            <span>调音器</span>
          </Button>
          <Button
            className="focus-tool"
            data-material={e.id}
            onClick={() => c.setDialog({ kind: "materials", id: e.id })}
          >
            {utilityIcons.materials}
            <span>课程资料</span>
          </Button>
        </div>
      </div>

      {s.metroOpen && !p.noMetronome && <MetronomeBar id={e.id} />}

      <div className="focus-main">
        {showClockPane && (
          <div
            id="focus-clock"
            className={d.running ? "clock-running" : ""}
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
            <div id="focus-requirements">
              <Requirements id={e.id} />
            </div>
          </div>
        )}
        {showScorePane && <ScoreHost id={e.id} />}
        {showPitchPane && (
          <div className="pitch-pane" data-pitch-stage="true">
            <PitchStage
              embedded={s.focusView === "score-pitch"}
              onClose={() =>
                c.setFocusView(
                  s.focusView === "score-pitch" ? "score" : "timer",
                )
              }
            />
          </div>
        )}
        {s.positionOpen && (
          <div className="position-companion-pane">
            <PositionHost />
          </div>
        )}
        {s.tunerOpen && (
          <div className="focus-tuner-overlay">
            <TunerHost />
          </div>
        )}
      </div>

      <div className="focus-actions">
        {awayFromTimer && (
          <button
            type="button"
            className="passive-clock passive-clock-btn"
            onClick={() => c.returnToTimer()}
            title="返回计时主视图"
          >
            <span
              className={`passive-clock-dot ${d.running ? "is-running" : ""}`}
              aria-hidden="true"
            />
            <span data-session-time role="timer">
              {clock(d.elapsedMs / 1000)}
            </span>{" "}
            · {d.running ? "练习中" : "已暂停"}
            <span className="passive-clock-return">返回计时</span>
          </button>
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
function ScoreHost({ id }: { id: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    c.run(() =>
      showScore(id, shortTitle(c.lesson(id)), {
        host,
        onClose: () =>
          c.setFocusView(
            c.getSnapshot().focusView === "score-pitch" ? "pitch" : "timer",
          ),
        onPlayStart: () => c.stopMetronome(),
      }),
    );
    return () => {
      closeScore();
    };
  }, [id]);
  return <div id="focus-tool-content" data-tool="score" ref={ref} />;
}
function PositionHost({ standalone = false }: { standalone?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current;
    if (!standalone && !host) return;
    const trigger = document.activeElement as HTMLElement | null;
    showPositionReference({
      host: standalone ? null : host,
      onClose: () => c.setPositionOpen(false),
      subscribePitchFrames,
      playReferenceMidi,
    });
    if (!standalone && host) {
      host.tabIndex = -1;
      host.focus({ preventScroll: true });
    }
    return () => {
      closePositionReference();
      if (
        !standalone &&
        host &&
        trigger?.isConnected &&
        (!document.activeElement ||
          document.activeElement === document.body ||
          host.contains(document.activeElement))
      ) {
        trigger.focus({ preventScroll: true });
      }
    };
  }, [standalone]);
  if (standalone) return null;
  return <div className="position-host" data-tool="position" ref={ref} />;
}
function TunerHost({ standalone = false }: { standalone?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current;
    if (!standalone && !host) return;
    const trigger = document.activeElement as HTMLElement | null;
    showTuner({
      host: standalone ? null : host,
      onClose: () => c.closeTunerOverlay(),
    });
    if (!standalone && host) {
      host.tabIndex = -1;
      host.focus({ preventScroll: true });
    }
    return () => {
      closeTuner();
      if (
        !standalone &&
        host &&
        trigger?.isConnected &&
        (!document.activeElement ||
          document.activeElement === document.body ||
          host.contains(document.activeElement))
      ) {
        trigger.focus({ preventScroll: true });
      }
    };
  }, [standalone]);
  if (standalone) return null;
  return <div className="tuner-host" data-tool="tuner" ref={ref} />;
}
function MetronomeBar({ id }: { id?: string }) {
  const s = usePractice();
  const p = id ? teacherPrescription(c.assignment(id)) : null;
  const fixed = !!p?.fixedBpm;
  const activeBpm =
    s.metroPlaying && s.metroBpm ? s.metroBpm : s.metroTargetBpm;
  const [draftText, setDraftText] = useState(String(activeBpm));

  useEffect(() => {
    setDraftText(String(activeBpm));
  }, [activeBpm]);

  const stepBpm = (delta: number) => {
    const next = Math.max(20, Math.min(300, activeBpm + delta));
    setDraftText(String(next));
    c.run(() => c.setMetronomeBpm(next));
  };

  return (
    <section id="metro-panel" className="metro-bar" aria-label="节拍器">
      <div className="metro-bar-info">
        <h2>节拍器</h2>
        <span className="metro-bar-hint">
          {p ? p.tempo : "自由节拍 · 切页不中断"}
        </span>
      </div>
      <div className="metro-bpm-control">
        <Button
          className="compact metro-step-btn"
          aria-label="减 5 BPM"
          disabled={fixed || activeBpm <= 20}
          onClick={() => stepBpm(-5)}
        >
          -5
        </Button>
        <Button
          className="compact metro-step-btn"
          aria-label="减 1 BPM"
          disabled={fixed || activeBpm <= 20}
          onClick={() => stepBpm(-1)}
        >
          -1
        </Button>
        <label className="metro-bpm-field">
          <span>BPM</span>
          <input
            id="bpm"
            type="number"
            min="20"
            max="300"
            value={draftText}
            disabled={fixed}
            onChange={(e) => {
              const raw = e.target.value;
              setDraftText(raw);
              const parsed = Number(raw);
              if (
                raw.trim() !== "" &&
                Number.isInteger(parsed) &&
                parsed >= 20 &&
                parsed <= 300
              ) {
                c.run(() => c.setMetronomeBpm(parsed));
              }
            }}
            onBlur={() => {
              const parsed = Number(draftText);
              if (
                draftText.trim() !== "" &&
                Number.isInteger(parsed) &&
                parsed >= 20 &&
                parsed <= 300
              ) {
                if (parsed !== activeBpm) {
                  c.run(() => c.setMetronomeBpm(parsed));
                }
              } else {
                setDraftText(String(activeBpm));
              }
            }}
          />
        </label>
        <Button
          className="compact metro-step-btn"
          aria-label="加 1 BPM"
          disabled={fixed || activeBpm >= 300}
          onClick={() => stepBpm(1)}
        >
          +1
        </Button>
        <Button
          className="compact metro-step-btn"
          aria-label="加 5 BPM"
          disabled={fixed || activeBpm >= 300}
          onClick={() => stepBpm(5)}
        >
          +5
        </Button>
      </div>
      <div className="beats" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <i className="beat-dot" key={i} />
        ))}
      </div>
      <div className="metro-bar-actions">
        <Button
          variant={s.metroPlaying ? "secondary" : "primary"}
          className="compact"
          data-action="metro-toggle"
          onClick={() => {
            const parsed = Number(draftText);
            const target =
              draftText.trim() !== "" && Number.isFinite(parsed)
                ? parsed
                : activeBpm;
            c.run(() => c.toggleMetronome(target));
          }}
        >
          {s.metroPlaying ? "停止节拍" : "播放节拍"}
        </Button>
        <Button
          className="compact"
          data-action="metro-collapse"
          onClick={() => c.setMetroOpen(false)}
        >
          收起
        </Button>
      </div>
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
