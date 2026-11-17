export function createWorkerLifecycle() {
  let stopping = false;
  let stopReason = null;
  let activeRequest = null;

  function stop(reason) {
    if (stopping) return false;
    stopping = true;
    stopReason = reason instanceof Error ? reason : new Error(String(reason || "Worker stopping"));
    if (activeRequest && !activeRequest.signal.aborted) {
      activeRequest.abort(stopReason);
    }
    return true;
  }

  return {
    get stopping() { return stopping; },
    get stopReason() { return stopReason; },
    setActiveRequest(controller) {
      if (!controller || typeof controller.abort !== "function" || !controller.signal) {
        throw new TypeError("An AbortController is required");
      }
      activeRequest = controller;
      if (stopping && !controller.signal.aborted) controller.abort(stopReason);
    },
    clearActiveRequest(controller) {
      if (activeRequest === controller) activeRequest = null;
    },
    requestStop(reason = "Worker shutdown requested") {
      return stop(reason);
    },
    loseLease(reason = "Task lease lost") {
      return stop(reason);
    }
  };
}
