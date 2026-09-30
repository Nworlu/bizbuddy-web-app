import { describe, expect, it } from "vitest";
import { displayPhone, loginEmail, normalizePhone } from "./phone";

describe("normalizePhone", () => {
  it.each(["08031234567", "0803 123 4567", "+234 803 123 4567", "2348031234567", "8031234567", "0803-123-4567"])("reads %j as the same number", (input) => {
    expect(normalizePhone(input)).toBe("2348031234567");
  });

  it.each(["", "0803123456", "080312345678", "02012345678", "12345678901", "abc", "+44 7700 900123"])("rejects %j", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});

describe("login address", () => {
  const mailbox = "owner@gmail.com";

  it("adds the phone number to the mailbox", () => {
    expect(loginEmail("2348031234567", mailbox)).toBe("owner+2348031234567@gmail.com");
  });

  it("is the same for every way of typing the number", () => {
    expect(loginEmail(normalizePhone("0803 123 4567")!, mailbox)).toBe(loginEmail(normalizePhone("+2348031234567")!, mailbox));
  });

  it("ignores a plus tag already on the mailbox", () => {
    expect(loginEmail("2348031234567", "owner+bizbuddy@gmail.com")).toBe("owner+2348031234567@gmail.com");
  });

  it("refuses to guess when the mailbox isn't set", () => {
    expect(() => loginEmail("2348031234567", "")).toThrow();
  });
});

describe("displayPhone", () => {
  it("shows the number the Nigerian way", () => {
    expect(displayPhone("2348031234567")).toBe("0803 123 4567");
  });
});
