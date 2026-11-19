import { describe, expect, it } from "vitest";
import { safeNext } from "./LoginPage";

describe("safeNext", () => {
  it("accepta camins interns", () => expect(safeNext("/hub")).toBe("/hub"));
  it("no porta a Gestió: s'entra pel Hub", () => {
    expect(safeNext("/gestio/seguretat")).toBe("/");
    expect(safeNext("/gestio")).toBe("/");
    expect(safeNext("/seguretat")).toBe("/");
    expect(safeNext("/cyrano")).toBe("/cyrano");
  });
  it("rebutja adreces externes", () => {
    expect(safeNext("https://malvat.example")).toBe("/");
    expect(safeNext("//malvat.example")).toBe("/");
    expect(safeNext(null)).toBe("/");
  });
});
