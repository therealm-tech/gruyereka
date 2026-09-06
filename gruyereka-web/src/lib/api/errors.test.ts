import { describe, expect, it } from "vitest";
import {
  API_ERROR_CODES,
  ApiContractError,
  ApiError,
  ApiUnreachableError,
  isApiError,
  sentenceFor,
} from "@/lib/api/errors";

describe("sentenceFor", () => {
  it("has a French sentence for every code the API can answer with", () => {
    for (const code of API_ERROR_CODES) {
      const sentence = sentenceFor(new ApiError(code, 400, "english prose"));
      expect(sentence).toBeTruthy();
      expect(sentence).not.toContain("english prose");
    }
  });

  it("never leaks the API's English message to a reader", () => {
    const error = new ApiError("CONFLICT", 409, "cheese already exists");
    expect(sentenceFor(error)).not.toContain("already exists");
  });

  it("tells an unreachable server from a refused request", () => {
    expect(sentenceFor(new ApiUnreachableError("boom"))).toMatch(/injoignable/);
  });

  it("tells an answer it cannot read from a server that never answered", () => {
    const unreadable = sentenceFor(new ApiContractError("off contract", 400));
    expect(unreadable).toMatch(/ne sait pas lire/);
    expect(unreadable).not.toMatch(/injoignable/);
  });

  it("still says something about a failure it has never seen", () => {
    expect(sentenceFor(new TypeError("undefined is not a function"))).toBeTruthy();
  });
});

describe("isApiError", () => {
  it("narrows on the code, not on the status", () => {
    const conflict = new ApiError("CONFLICT", 409, "x");
    expect(isApiError(conflict, "CONFLICT")).toBe(true);
    expect(isApiError(conflict, "NOT_FOUND")).toBe(false);
    expect(isApiError(new Error("x"), "CONFLICT")).toBe(false);
  });

  it("keeps the offending fields for a form to show", () => {
    const error = new ApiError("VALIDATION_FAILED", 422, "x", { email: ["email"] });
    expect(error.fields?.email).toEqual(["email"]);
  });
});
