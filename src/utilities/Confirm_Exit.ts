"use client";
import { useCallback, useEffect, useRef } from "react";

type ConfirmExitOptions = {
  enabled?: boolean;
  message?: string;
  onConfirm?: () => void;
};

export default function useConfirmExit(options: ConfirmExitOptions = {}) {
  const { enabled = true, message = "Are you sure you want to exit?", onConfirm } = options;
  const isHandlingPopState = useRef(false);
  const hasPushedState = useRef(false);
  const skipNextPopState = useRef(false);
  const lastPromptAt = useRef(0);

  const confirmExit = useCallback(() => {
    if (!enabled) return true;
    const ok = window.confirm(message);
    if (ok) {
      skipNextPopState.current = true;
      if (onConfirm) onConfirm();
    }
    return ok;
  }, [enabled, message, onConfirm]);

  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    const handlePopState = () => {
      if (!enabled) return;
      if (skipNextPopState.current) {
        skipNextPopState.current = false;
        return;
      }
      if (isHandlingPopState.current) return;
      const now = Date.now();
      if (now - lastPromptAt.current < 500) return;
      lastPromptAt.current = now;
      isHandlingPopState.current = true;
      const ok = window.confirm(message);
      if (!ok) {
        history.pushState(null, "", window.location.href);
      }
      setTimeout(() => {
        isHandlingPopState.current = false;
      }, 0);
    };

    if (!hasPushedState.current) {
      history.pushState(null, "", window.location.href);
      hasPushedState.current = true;
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [enabled, message]);

  return confirmExit;
}
