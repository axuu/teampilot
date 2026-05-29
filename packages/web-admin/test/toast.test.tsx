import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ToastProvider, useToast } from "../src/components/Toast.js";

function Harness() {
  const show = useToast();
  return <div><button onClick={() => show("A")}>showA</button><button onClick={() => show("B")}>showB</button></div>;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("Toast", () => {
  it("shows a message then auto-clears after 2s", () => {
    render(<ToastProvider><Harness /></ToastProvider>);
    act(() => { screen.getByText("showA").click(); });
    expect(screen.getByText("A")).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(2000); });
    expect(screen.queryByText("A")).toBeNull();
  });
  it("rapid second show is not cleared early by the first timer", () => {
    render(<ToastProvider><Harness /></ToastProvider>);
    act(() => { screen.getByText("showA").click(); });
    act(() => { vi.advanceTimersByTime(1000); screen.getByText("showB").click(); });
    // 1s after A, B shown. Advance another 1s (A's original 2s would fire here) — B must still be visible.
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByText("B")).toBeInTheDocument();
    // B's own 2s completes
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.queryByText("B")).toBeNull();
  });
});
