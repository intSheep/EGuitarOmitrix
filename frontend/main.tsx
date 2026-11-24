import { useEffect, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, useLocation } from "react-router-dom";
import { Workspace, Focus, Finish } from "./components/practice-pages";
import { Catalog, History, DialogHost, WatchPanel } from "./components/records";
import { usePractice, clock } from "./components/common";
import { Button } from "./components/ui/button";
import { shortTitle } from "./domain/course";
import * as c from "./controllers/practice";
import {
  isClient,
  isAndroid,
  checkUpdates,
  clientBack,
} from "./platform/client";
import { version } from "../package.json";
import "./theme.css";

const navItems: [string, string, string][] = [
  ["practice", "练习台", "#i-strings"],
  ["catalog", "课程目录", "#i-book"],
  ["history", "练习回顾", "#i-clock"],
];

function App() {
  const s = usePractice(),
    location = useLocation(),
    name = location.pathname.replace(/^\//, "") || "practice";
  useEffect(() => {
    void c.initialize();
    window.eguitarClientBack = clientBack;
    if (isAndroid()) void checkUpdates({ automatic: true }).catch(() => {});
  }, []);
  useLayoutEffect(() => {
    document.body.classList.toggle("is-focusing", name === "focus");
    document.body.dataset.clientRoute = name;
    const p = new URLSearchParams(location.search);
    document.body.classList.toggle(
      "client-detail",
      p.get("view") === "lesson" || (!p.has("view") && p.has("lesson")),
    );
    if (isClient()) {
      document.documentElement.dataset.client = isAndroid()
        ? "android"
        : "desktop";
      if (window.eguitarDesktop?.platform) {
        document.documentElement.dataset.platform =
          window.eguitarDesktop.platform;
      }
    }
  }, [name, location.search]);
  return (
    <>
      <a
        className="skip-link"
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        跳到主要内容
      </a>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="icon-library"
        aria-hidden="true"
      >
        <symbol id="i-book" viewBox="0 0 24 24">
          <path d="M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H4zM20 4h-4a3 3 0 0 0-3 3M13 21a4 4 0 0 1 4-2h3V4" />
        </symbol>
        <symbol id="i-external" viewBox="0 0 24 24">
          <path d="M14 4h6v6M20 4 10 14M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" />
        </symbol>
        <symbol id="i-arrow" viewBox="0 0 24 24">
          <path d="M4 12h16m-6-6 6 6-6 6" />
        </symbol>
        <symbol id="i-strings" viewBox="0 0 24 24">
          <path d="M6 3v18M12 3v18M18 3v18M3 8h18M3 16h18" />
        </symbol>
        <symbol id="i-compass" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" />
          <path d="m16 8-2 6-6 2 2-6z" />
        </symbol>
        <symbol id="i-search" viewBox="0 0 24 24">
          <circle cx="10" cy="10" r="6" />
          <path d="m15 15 6 6" />
        </symbol>
        <symbol id="i-clock" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </symbol>
        <symbol id="i-close" viewBox="0 0 24 24">
          <path d="m6 6 12 12M18 6 6 18" />
        </symbol>
      </svg>
      <header className="app-header">
        <a className="brand" href="#practice">
          <img src="./assets/mark.svg" width="32" height="32" alt="" />
          <span className="brand-copy">
            <span>帅帅练琴屋</span>
            {isClient() && <small className="app-version">v{version}</small>}
          </span>
        </a>
        <nav className="navigation" aria-label="主导航">
          {navItems.map(([key, label, icon]) => (
            <a
              key={key}
              data-nav={key}
              aria-current={name === key ? "page" : undefined}
              href={`#${key}`}
            >
              <svg className="icon" aria-hidden="true">
                <use href={icon} />
              </svg>
              <span>{label}</span>
            </a>
          ))}
        </nav>
      </header>
      <div className="workspace">
        {s.draft && name !== "focus" && name !== "finish" && (
          <div
            id="session-access"
            className={name === "practice" ? "practice-list-only" : undefined}
          >
            <div className="session-access-copy">
              <span
                className={`session-access-dot ${s.draft.running ? "is-running" : ""}`}
                aria-hidden="true"
              />
              <span>
                {s.draft.running ? "计时进行中" : "练习已暂停"}
                {s.course ? ` · ${shortTitle(c.lesson(s.draft.entryId))}` : ""}
                {" · "}
                <strong data-session-time>
                  {clock(s.draft.elapsedMs / 1000)}
                </strong>
              </span>
            </div>
            <a
              className="button primary compact"
              href={s.draft.finishing ? "#finish" : "#focus"}
            >
              {s.draft.finishing ? "确认练习" : "返回计时"}
            </a>
          </div>
        )}
        {s.metroPlaying &&
          name !== "focus" &&
          !(name === "practice" && s.metroOpen) && (
            <div id="global-metro-bar" role="status">
              <div className="global-metro-copy">
                <span
                  className="global-metro-dot"
                  data-metro-beat-pulse=""
                  aria-hidden="true"
                />
                <span>
                  节拍器播放中 · {s.metroBpm ?? s.metroTargetBpm} BPM
                </span>
              </div>
              <div className="global-metro-actions">
                {name === "practice" && (
                  <Button
                    className="compact"
                    onClick={() => c.setMetroOpen(true)}
                  >
                    调整
                  </Button>
                )}
                <Button
                  className="compact"
                  data-action="global-metro-stop"
                  onClick={() => c.stopMetronome()}
                >
                  停止节拍
                </Button>
              </div>
            </div>
          )}
        <main id="main" tabIndex={-1}>
          <div id="app" aria-busy={!s.course}>
            {s.fatal ? (
              <p role="alert">{s.fatal}</p>
            ) : !s.course ? (
              <p>正在载入课程目录…</p>
            ) : (
              <>
                {s.storageError && (
                  <section className="storage-banner" role="status">
                    <div>
                      <strong>练习记录暂时不可用</strong>
                      <p>{s.storageError}</p>
                    </div>
                    <Button
                      data-action="retry-storage"
                      onClick={() => c.run(c.connectStorage)}
                    >
                      重试
                    </Button>
                  </section>
                )}
                <WatchPanel />
                {name === "focus" ? (
                  <Focus />
                ) : name === "finish" ? (
                  <Finish key={s.draft?.id} />
                ) : name === "catalog" ? (
                  <Catalog />
                ) : name === "history" ? (
                  <History />
                ) : (
                  <Workspace />
                )}
              </>
            )}
          </div>
        </main>
      </div>
      <DialogHost />
      <div
        id="notice"
        className="toast"
        role="status"
        aria-live="polite"
        hidden={!s.notice}
      >
        {s.notice}
        <button aria-label="关闭提示" onClick={() => c.notify("")}>
          ×
        </button>
      </div>
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <HashRouter>
    <App />
  </HashRouter>,
);
