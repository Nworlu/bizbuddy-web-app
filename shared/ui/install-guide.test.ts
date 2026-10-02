import { describe, expect, it } from "vitest";
import { installGuide } from "./install-guide";

describe("install guide", () => {
  it("uses the browser's install button when the phone offers one", () => {
    expect(installGuide({ ios: false, canPrompt: true })).toBe("button");
    expect(installGuide({ ios: true, canPrompt: true })).toBe("button");
  });

  it("tells an iPhone to use Share when there is no install button", () => {
    expect(installGuide({ ios: true, canPrompt: false })).toBe("ios");
  });

  it("explains both phones when the browser will not install it", () => {
    expect(installGuide({ ios: false, canPrompt: false })).toBe("browser");
  });
});
