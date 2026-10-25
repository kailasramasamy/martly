// Saves to the list from outside its screen (a walk that fills it) run one after another; the list screen waits for
// them before it reloads, so it never shows the list from before the last save
let pending: Promise<unknown> = Promise.resolve();

export function queueListSave(save: () => Promise<unknown>) {
  pending = pending.then(save, save);
}

export const listSavesDone = () => pending;
