import { useSyncExternalStore } from "react";
import { getSnapshot, subscribe, assignment } from "../controllers/practice";
import { teacherPrescription, todayPractice } from "../domain/prescription";
export const usePractice = () =>
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
export const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
export function DailyProgress({ id }: { id: string }) {
  const s = usePractice(),
    a = assignment(id),
    p = teacherPrescription(a),
    v = todayPractice(s.logs, s.draft, a);
  return (
    <section className="daily-progress" aria-label="本课今日进度">
      <div className="daily-heading">
        <h3>本课今天</h3>
        <span>未练时长不结转</span>
      </div>
      <div className="prescription-specs">
        <div className="spec-card">
          <span className="spec-label">每日要求时长</span>
          <p className="teacher-dose">
            老师要求 ·{" "}
            {p.dailyMinutes === null
              ? "每日时长未明确"
              : `每天 ${p.dailyMinutes} 分钟`}
          </p>
        </div>
        <div className="spec-card">
          <span className="spec-label">速度与节拍要求</span>
          <p className="teacher-tempo">{p.tempo}</p>
        </div>
      </div>
      <div className="daily-values">
        <span>
          已练 <strong>{clock(v.seconds)}</strong>
        </span>
        {v.remainingSeconds !== null && (
          <span>
            {v.completed ? (
              "今日时长已完成"
            ) : (
              <>
                还差 <strong>{clock(v.remainingSeconds)}</strong>
              </>
            )}
          </span>
        )}
      </div>
      {v.targetSeconds !== null && (
        <progress
          aria-label="本课今天已练时长"
          max={v.targetSeconds}
          value={Math.min(v.seconds, v.targetSeconds)}
        />
      )}
    </section>
  );
}
export function Requirements({ id }: { id: string }) {
  const a = assignment(id);
  return a ? (
    <section className="requirements">
      <h3>练习要求</h3>
      <ul>
        {a.summary
          .split(/[；。]/)
          .filter(Boolean)
          .map((line, i) => (
            <li key={i}>{line}</li>
          ))}
      </ul>
      <DailyProgress id={id} />
    </section>
  ) : null;
}
