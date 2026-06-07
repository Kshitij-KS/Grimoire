// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useImmersiveKeyboard } from "@/lib/hooks/use-immersive-keyboard";

describe("useImmersiveKeyboard", () => {
  let onExit: ReturnType<typeof vi.fn<() => void>>;
  let onSave: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    onExit = vi.fn<() => void>();
    onSave = vi.fn<() => void>();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function dispatchKey(key: string, opts: Partial<KeyboardEventInit> = {}) {
    const event = new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
      ...opts,
    });
    const preventDefaultSpy = vi.spyOn(event, "preventDefault");
    const stopPropagationSpy = vi.spyOn(event, "stopPropagation");
    window.dispatchEvent(event);
    return { preventDefaultSpy, stopPropagationSpy };
  }

  describe("when isImmersive is true", () => {
    it("calls onExit and stops propagation when Escape is pressed", () => {
      renderHook(() =>
        useImmersiveKeyboard({ isImmersive: true, onExit, onSave, isSaving: false })
      );

      const { preventDefaultSpy, stopPropagationSpy } = dispatchKey("Escape");

      expect(onExit).toHaveBeenCalledOnce();
      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(stopPropagationSpy).toHaveBeenCalled();
    });

    it("calls onSave and prevents default on Ctrl+S", () => {
      renderHook(() =>
        useImmersiveKeyboard({ isImmersive: true, onExit, onSave, isSaving: false })
      );

      const { preventDefaultSpy } = dispatchKey("s", { ctrlKey: true });

      expect(onSave).toHaveBeenCalledOnce();
      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it("calls onSave and prevents default on Cmd+S (macOS)", () => {
      renderHook(() =>
        useImmersiveKeyboard({ isImmersive: true, onExit, onSave, isSaving: false })
      );

      const { preventDefaultSpy } = dispatchKey("s", { metaKey: true });

      expect(onSave).toHaveBeenCalledOnce();
      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it("ignores Ctrl+S when save is already in progress", () => {
      renderHook(() =>
        useImmersiveKeyboard({ isImmersive: true, onExit, onSave, isSaving: true })
      );

      const { preventDefaultSpy } = dispatchKey("s", { ctrlKey: true });

      expect(onSave).not.toHaveBeenCalled();
      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it("calls onExit and prevents default on Ctrl+Shift+F", () => {
      renderHook(() =>
        useImmersiveKeyboard({ isImmersive: true, onExit, onSave, isSaving: false })
      );

      const { preventDefaultSpy } = dispatchKey("F", { ctrlKey: true, shiftKey: true });

      expect(onExit).toHaveBeenCalledOnce();
      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it("calls onExit and prevents default on Cmd+Shift+F (macOS)", () => {
      renderHook(() =>
        useImmersiveKeyboard({ isImmersive: true, onExit, onSave, isSaving: false })
      );

      const { preventDefaultSpy } = dispatchKey("F", { metaKey: true, shiftKey: true });

      expect(onExit).toHaveBeenCalledOnce();
      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it("does not call handlers for unrelated keys", () => {
      renderHook(() =>
        useImmersiveKeyboard({ isImmersive: true, onExit, onSave, isSaving: false })
      );

      dispatchKey("a");
      dispatchKey("Enter");
      dispatchKey("Tab");

      expect(onExit).not.toHaveBeenCalled();
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  describe("when isImmersive is false", () => {
    it("does not register listeners", () => {
      renderHook(() =>
        useImmersiveKeyboard({ isImmersive: false, onExit, onSave, isSaving: false })
      );

      dispatchKey("Escape");
      dispatchKey("s", { ctrlKey: true });
      dispatchKey("F", { ctrlKey: true, shiftKey: true });

      expect(onExit).not.toHaveBeenCalled();
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  describe("cleanup", () => {
    it("removes listener when isImmersive changes to false", () => {
      const { rerender } = renderHook(
        (props) => useImmersiveKeyboard(props),
        { initialProps: { isImmersive: true, onExit, onSave, isSaving: false } }
      );

      // Listener active
      dispatchKey("Escape");
      expect(onExit).toHaveBeenCalledOnce();
      onExit.mockClear();

      // Deactivate
      rerender({ isImmersive: false, onExit, onSave, isSaving: false });

      dispatchKey("Escape");
      expect(onExit).not.toHaveBeenCalled();
    });

    it("removes listener on unmount", () => {
      const { unmount } = renderHook(() =>
        useImmersiveKeyboard({ isImmersive: true, onExit, onSave, isSaving: false })
      );

      unmount();

      dispatchKey("Escape");
      expect(onExit).not.toHaveBeenCalled();
    });
  });
});
