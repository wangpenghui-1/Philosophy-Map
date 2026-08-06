const activeRuns = new Map<string, AbortController>();

export function beginConversationRun(conversationId: string) {
  activeRuns.get(conversationId)?.abort();
  const controller = new AbortController();
  activeRuns.set(conversationId, controller);
  return controller;
}

export function finishConversationRun(conversationId: string, controller: AbortController) {
  if (activeRuns.get(conversationId) === controller) activeRuns.delete(conversationId);
}

export function cancelConversationRun(conversationId: string) {
  const controller = activeRuns.get(conversationId);
  if (!controller) return false;
  controller.abort();
  activeRuns.delete(conversationId);
  return true;
}
