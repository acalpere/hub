import { describe, expect, it } from "vitest";
import { safeNext } from "./LoginPage";

describe("safeNext", () => {
  it("accepta camins interns", () => expect(safeNext("/hub")).toBe("/hub"));
  it("rebutja adreces externes", () => {
    expect(safeNext("https://malvat.example")).toBe("/");
    expect(safeNext("//malvat.example")).toBe("/");
    expect(safeNext(null)).toBe("/");
  });
});
