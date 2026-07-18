import { describe, expect, it } from "vitest";
import { evaluateVoiceGate, VOICE_MIN_CONFIDENCE } from "./voiceGate";

describe("evaluateVoiceGate", () => {
  it("allows auto-intent for high-confidence enrolled contact", () => {
    const g = evaluateVoiceGate({
      confidence: 0.92,
      shape: 0.9,
      amount: 50,
      recipient: "Janhvi",
      contacts: ["Janhvi", "Nike"],
      production: true,
    });
    expect(g.autoIntent).toBe(true);
    expect(g.lowConfidence).toBe(false);
    expect(g.unknownContact).toBe(false);
  });

  it("flags low confidence below floor", () => {
    const g = evaluateVoiceGate({
      confidence: Math.max(0, VOICE_MIN_CONFIDENCE - 0.2),
      shape: 0.9,
      amount: 50,
      recipient: "Janhvi",
      contacts: ["Janhvi"],
      production: true,
    });
    expect(g.lowConfidence).toBe(true);
    expect(g.autoIntent).toBe(false);
  });

  it("blocks unknown contacts in production", () => {
    const g = evaluateVoiceGate({
      confidence: 0.95,
      shape: 0.95,
      amount: 25,
      recipient: "Stranger",
      contacts: ["Janhvi"],
      production: true,
    });
    expect(g.unknownContact).toBe(true);
    expect(g.autoIntent).toBe(false);
  });
});
