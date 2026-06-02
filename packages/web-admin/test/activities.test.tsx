import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Activities from "../src/pages/Activities.js";

const rows = [
  { id: "a1", name: "周日训练", type: "training", startTime: "2026-06-01T06:30:00.000Z", location: "二操场", status: "published", attendanceSummary: "3 去 ｜ 1 不去 ｜ 2 未反馈", reviewStatus: "无记录" },
];
beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, status: 200, json: async () => rows } as Response);
});

describe("Activities", () => {
  it("renders rows with type/status labels + derived columns and a 创建活动 link", async () => {
    render(<MemoryRouter><Activities /></MemoryRouter>);
    expect(await screen.findByText("周日训练")).toBeInTheDocument();
    expect(screen.getByText("训练")).toBeInTheDocument();
    expect(screen.getByText("已发布")).toBeInTheDocument();
    expect(screen.getByText("3 去 ｜ 1 不去 ｜ 2 未反馈")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "创建活动" })).toBeInTheDocument();
  });
});
