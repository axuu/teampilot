import { describe, it, expect } from "vitest";
import { extractJsonText } from "../src/ai/client.js";

describe("extractJsonText", () => {
  it("returns plain JSON object text unchanged (parseable)", () => {
    expect(JSON.parse(extractJsonText('{"a":1}'))).toEqual({ a: 1 });
  });
  it("strips ```json fences", () => {
    expect(JSON.parse(extractJsonText('```json\n{"a":1,"b":"x"}\n```'))).toEqual({ a: 1, b: "x" });
  });
  it("strips bare ``` fences", () => {
    expect(JSON.parse(extractJsonText('```\n{"a":1}\n```'))).toEqual({ a: 1 });
  });
  it("extracts the JSON object from surrounding prose", () => {
    expect(JSON.parse(extractJsonText('好的，结果如下：{"goal":"练发球","plan":"…"} 希望有帮助'))).toEqual({ goal: "练发球", plan: "…" });
  });
  it("returns the body as-is when there is no JSON object", () => {
    expect(extractJsonText("not json at all")).toBe("not json at all");
  });
});
