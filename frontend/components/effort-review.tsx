import { usePractice, clock } from "./common";
import { activeLogs, OUTCOMES } from "../storage/practice-store";
import { dailySeconds, dayKey } from "../domain/session";
import { totalWatchSeconds } from "../domain/study";
import { lesson, route } from "../controllers/practice";
import { shortTitle } from "../domain/course";
export function EffortReview() {
  const s = usePractice(),
    logs = activeLogs(s.logs),
    days = dailySeconds(logs),
    seconds = logs.reduce((n, l) => n + l.minutes * 60, 0),
    watch = totalWatchSeconds(s.watches),
    filter = route().params.get("day");
  const dates = Array.from({ length: 84 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - 83 + i);
      return dayKey(date);
    }),
    week = dates.slice(-7),
    max = Math.max(60, ...week.map((d) => days[d] || 0));
  return (
    <>
      <div className="study-totals" aria-label="学习时长">
        <span>
          学习合计 <strong>{clock(seconds + watch)}</strong>
        </span>
        <span>练习 {clock(seconds)}</span>
        <span>看课 {clock(watch)}</span>
      </div>
      <div className="stat-grid">
        <article>
          <strong>{clock(seconds)}</strong>
          <span>全部课程累计</span>
        </article>
        <article>
          <strong>{logs.length}</strong>
          <span>次练习</span>
        </article>
        <article>
          <strong>{Object.keys(days).length}</strong>
          <span>个练习日</span>
        </article>
      </div>
      <div className="review-grid">
        <section className="review-panel">
          <h2>最近十二周</h2>
          <div className="heatmap">
            {dates.map((d) => (
              <a
                key={d}
                className={`heat-cell level-${!days[d] ? 0 : days[d] < 300 ? 1 : days[d] < 900 ? 2 : 3}`}
                data-day={d}
                href={`#history?day=${d}`}
                aria-label={`${d}，练习 ${clock(days[d] || 0)}`}
                title={`${d} · ${clock(days[d] || 0)}`}
              />
            ))}
          </div>
          <div className="heat-labels">
            <span>{dates[0]}</span>
            <span>今天</span>
          </div>
        </section>
        <section className="review-panel">
          <h2>最近七天</h2>
          <div className="week-bars" aria-label="最近七天练习时长">
            {week.map((d) => (
              <div className="bar-column" key={d}>
                <strong>{clock(days[d] || 0)}</strong>
                <div className="bar-track">
                  <svg
                    className="bar-svg"
                    viewBox="0 0 32 100"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <rect
                      x="0"
                      y={100 - (100 * (days[d] || 0)) / max}
                      width="32"
                      height={(100 * (days[d] || 0)) / max}
                      rx="5"
                    />
                  </svg>
                </div>
                <span>{d.slice(5)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="review-panel">
        <h2>{filter || "最近练习"}</h2>
        {filter && <a href="#history">全部记录</a>}
        {logs
          .filter((l) => !filter || dailySeconds([l])[filter])
          .map((l) => (
            <a
              className="session-row"
              key={l.id}
              href={`#history?session=${l.id}`}
            >
              <span>
                {new Date(l.practicedAt).toLocaleString("zh-CN")}
                <strong>{shortTitle(lesson(l.entryId))}</strong>
              </span>
              <span>
                {clock(l.minutes * 60)}
                {l.bpm ? ` · ${l.bpm} BPM` : ""}
                {l.outcome ? ` · ${OUTCOMES[l.outcome]}` : ""}
              </span>
            </a>
          ))}
      </section>
    </>
  );
}
