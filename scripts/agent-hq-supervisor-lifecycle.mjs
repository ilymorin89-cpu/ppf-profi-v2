export function createSupervisorLifecycle({ onStop = () => {} } = {}) {
  let stopping = false;
  let sleepTimer = null;
  let wakeSleep = null;

  function requestStop(signal = "shutdown") {
    if (stopping) return false;
    stopping = true;
    onStop(signal);
    if (sleepTimer) clearTimeout(sleepTimer);
    sleepTimer = null;
    wakeSleep?.();
    wakeSleep = null;
    return true;
  }

  function waitForNextCycle(ms) {
    if (stopping) return Promise.resolve();
    return new Promise(resolve => {
      wakeSleep = resolve;
      sleepTimer = setTimeout(() => {
        sleepTimer = null;
        wakeSleep = null;
        resolve();
      }, ms);
      sleepTimer.unref?.();
    });
  }

  function close() {
    if (sleepTimer) clearTimeout(sleepTimer);
    sleepTimer = null;
    wakeSleep?.();
    wakeSleep = null;
  }

  return {
    get stopping() { return stopping; },
    requestStop,
    waitForNextCycle,
    close
  };
}
