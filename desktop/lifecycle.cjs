// One persistence barrier for close/quit. A failure never silently drops a draft.
function createCloseBarrier({ prepare, ask }) {
  let pending = null;
  return function persistBeforeClose() {
    if (pending) return pending;
    pending = (async () => {
      for (;;) {
        try {
          await prepare();
          return true;
        } catch (error) {
          const { response } = await ask({
            type: "warning",
            title: "练习尚未保存",
            message: "无法保存当前练习进度",
            detail: String(error.message || error),
            buttons: ["返回应用", "重试保存", "放弃未保存的变更"],
            defaultId: 0,
            cancelId: 0,
            noLink: true,
          });
          if (response === 0) return false;
          if (response === 2) return true;
        }
      }
    })().finally(() => {
      pending = null;
    });
    return pending;
  };
}
module.exports = { createCloseBarrier };
