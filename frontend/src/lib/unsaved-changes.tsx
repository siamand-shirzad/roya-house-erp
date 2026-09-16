import { useEffect, useRef } from "react";
import { useBlocker } from "react-router-dom";

/**
 * Blocks in-app navigation (sidebar/header links, the header back button,
 * browser back/forward, the command palette) while `isDirty` is true, and
 * warns on tab close/reload via `beforeunload`. This needs a data router
 * (see App.tsx's `createBrowserRouter`) — `useBlocker` only works there.
 *
 * Render a confirm dialog keyed off the returned blocker's `state`
 * ("blocked" while a navigation attempt is paused waiting for a decision),
 * and call `blocker.proceed()` to let it through or `blocker.reset()` to
 * cancel it and stay on the page.
 *
 * `skipNext()` lets the caller make exactly one upcoming navigation bypass
 * the guard even though the form is still "dirty" at that instant — e.g. the
 * replace-with-real-id navigate right after a new document is first saved,
 * where the save that makes it clean and the navigate happen in the same
 * tick, before the "clean" state has actually rendered.
 */
export function useUnsavedChangesBlocker(isDirty: boolean) {
  const skipRef = useRef(false);

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (skipRef.current) {
      skipRef.current = false;
      return false;
    }
    // Never hold up the sign-in redirect: RequireAuth unmounts the page (and
    // this blocker's dialog with it) on a 401, and the edits can't be saved
    // against a dead session anyway. Being stuck on a blank page would be
    // worse than losing them.
    if (nextLocation.pathname === "/login") return false;
    return isDirty && (currentLocation.pathname !== nextLocation.pathname ||
      (currentLocation.pathname.startsWith("/documents/") && currentLocation.search !== nextLocation.search));
  });

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  return {
    blocker,
    skipNext: () => {
      skipRef.current = true;
    },
  };
}
