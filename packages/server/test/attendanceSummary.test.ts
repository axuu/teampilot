import { describe, it, expect } from "vitest";
import { attendanceSummary } from "../src/activities/service.js";

describe("attendanceSummary format", () => {
  it("published/draft: number-first with ｜ separators", () => {
    const a = { status: "published", participants: [
      { attendanceResponse: "going", actualAttendance: null },
      { attendanceResponse: "not_going", actualAttendance: null },
      { attendanceResponse: "no_response", actualAttendance: null },
      { attendanceResponse: "no_response", actualAttendance: null },
    ] };
    expect(attendanceSummary(a)).toBe("1 去 ｜ 1 不去 ｜ 2 未反馈");
  });
  it("ended: 实到/应到 number-first", () => {
    const a = { status: "ended", participants: [
      { attendanceResponse: "going", actualAttendance: "present" },
      { attendanceResponse: "going", actualAttendance: "absent" },
    ] };
    expect(attendanceSummary(a)).toBe("1 实到 ｜ 2 应到");
  });
  it("cancelled: dash", () => {
    expect(attendanceSummary({ status: "cancelled", participants: [] })).toBe("—");
  });
  it("draft: same format as published", () => {
    const a = { status: "draft", participants: [
      { attendanceResponse: "going", actualAttendance: null },
    ] };
    expect(attendanceSummary(a)).toBe("1 去 ｜ 0 不去 ｜ 0 未反馈");
  });
});
