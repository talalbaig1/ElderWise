import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeWhatsAppNumber,
  validateRequiredWhatsAppNumber,
  WHATSAPP_E164_ERROR,
} from "./whatsapp-e164.ts";

describe("normalizeWhatsAppNumber", () => {
  it("accepts spaced international format", () => {
    assert.equal(normalizeWhatsAppNumber("+966 569 362 418"), "+966569362418");
  });

  it("accepts hyphenated international format", () => {
    assert.equal(normalizeWhatsAppNumber("+966-569-362418"), "+966569362418");
  });

  it("accepts bracketed international format", () => {
    assert.equal(normalizeWhatsAppNumber("(+966) 569-362418"), "+966569362418");
  });

  it("accepts 00 international prefix", () => {
    assert.equal(normalizeWhatsAppNumber("00966569362418"), "+966569362418");
  });
});

describe("validateRequiredWhatsAppNumber rejections", () => {
  it("rejects letter typo in digit run", () => {
    const result = validateRequiredWhatsAppNumber("+96656936241O");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, WHATSAPP_E164_ERROR);
    }
  });

  it("rejects label prefix before number", () => {
    const result = validateRequiredWhatsAppNumber("Mobile: +966569362418");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, WHATSAPP_E164_ERROR);
    }
  });

  it("rejects label suffix after number", () => {
    const result = validateRequiredWhatsAppNumber("+966569362418 (mobile)");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, WHATSAPP_E164_ERROR);
    }
  });
});

describe("validateRequiredWhatsAppNumber passing cases", () => {
  for (const input of [
    "+966 569 362 418",
    "+966-569-362418",
    "(+966) 569-362418",
    "00966569362418",
  ]) {
    it(`accepts ${input}`, () => {
      const result = validateRequiredWhatsAppNumber(input);
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.value, "+966569362418");
      }
    });
  }
});
