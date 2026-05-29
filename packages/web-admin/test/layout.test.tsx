import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Layout from "../src/components/Layout.js";
import { AuthProvider } from "../src/auth/useAuth.js";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, status: 200, json: async () => ({ displayName: "Levin" }) } as Response);
});

describe("Layout", () => {
  it("renders team name, nav items and logout", async () => {
    render(<AuthProvider><MemoryRouter><Layout><div>内容</div></Layout></MemoryRouter></AuthProvider>);
    expect(await screen.findByText("队员管理")).toBeInTheDocument();
    expect(screen.getByText("活动管理")).toBeInTheDocument();
    expect(screen.getByText("退出登录")).toBeInTheDocument();
    expect(screen.getByText("内容")).toBeInTheDocument();
  });
});
