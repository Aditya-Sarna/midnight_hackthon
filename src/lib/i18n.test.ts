import { describe, expect, it } from "vitest";
import { detectLocaleFromText, localeFromSpeechTag, payCopy } from "./i18n";

describe("detectLocaleFromText", () => {
  it("detects Hindi Devanagari", () => {
    expect(detectLocaleFromText("भेजो 500 को Priya")).toBe("hi");
  });

  it("detects Spanish verbs", () => {
    expect(detectLocaleFromText("pagar 200 a Maria")).toBe("es");
  });

  it("detects French verbs", () => {
    expect(detectLocaleFromText("payer 30 à Sophie")).toBe("fr");
  });

  it("detects Arabic script", () => {
    expect(detectLocaleFromText("أرسل 50 إلى أحمد")).toBe("ar");
  });

  it("detects Japanese", () => {
    expect(detectLocaleFromText("500円を太郎に払って")).toBe("ja");
  });

  it("falls back to speech tag", () => {
    expect(detectLocaleFromText("500 Janhvi", "hi-IN")).toBe("hi");
  });
});

describe("localeFromSpeechTag", () => {
  it("maps BCP-47 tags", () => {
    expect(localeFromSpeechTag("es-MX")).toBe("es");
    expect(localeFromSpeechTag("zh-CN")).toBe("zh");
  });
});

describe("payCopy", () => {
  it("returns Accept/Decline in Spanish", () => {
    const c = payCopy("es");
    expect(c.accept).toBe("Aceptar");
    expect(c.decline).toBe("Rechazar");
  });

  it("returns Accept/Decline in Hindi", () => {
    const c = payCopy("hi");
    expect(c.accept).toBe("स्वीकार");
    expect(c.decline).toBe("अस्वीकार");
  });
});
