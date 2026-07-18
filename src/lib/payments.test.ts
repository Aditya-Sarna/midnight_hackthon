import { describe, expect, it } from "vitest";
import { parseUtterance } from "./payments";

describe("parseUtterance", () => {
  it("parses pay amount to name", () => {
    expect(parseUtterance("pay 500 to Janhvi")).toMatchObject({
      amount: 500,
      recipient: "Janhvi",
    });
  });

  it("parses send amount name", () => {
    expect(parseUtterance("send 1000 Priya")).toMatchObject({
      amount: 1000,
      recipient: "Priya",
    });
  });

  it("parses send name amount", () => {
    expect(parseUtterance("send Rahul 250")).toMatchObject({
      amount: 250,
      recipient: "Rahul",
    });
  });

  it("parses amount to name", () => {
    expect(parseUtterance("200 to Anita")).toMatchObject({ amount: 200, recipient: "Anita" });
  });

  it("parses amount for name", () => {
    expect(parseUtterance("300 for Karan")).toMatchObject({ amount: 300, recipient: "Karan" });
  });

  it("strips rupees token", () => {
    expect(parseUtterance("pay 400 rupees to Sam")).toMatchObject({
      amount: 400,
      recipient: "Sam",
    });
  });

  it("strips INR token", () => {
    expect(parseUtterance("pay INR 150 to Meera")).toMatchObject({
      amount: 150,
      recipient: "Meera",
    });
  });

  it("strips Rs. token", () => {
    expect(parseUtterance("send Rs. 75 to Deepak")).toMatchObject({
      amount: 75,
      recipient: "Deepak",
    });
  });

  it("parses USD forms", () => {
    expect(parseUtterance("pay $25 to Janhvi")).toMatchObject({ amount: 25, recipient: "Janhvi" });
    expect(parseUtterance("pay 25 dollars to Janhvi")).toMatchObject({
      amount: 25,
      recipient: "Janhvi",
    });
    expect(parseUtterance("pay USD 40 to Priya")).toMatchObject({ amount: 40, recipient: "Priya" });
  });

  it("parses EUR / GBP forms", () => {
    expect(parseUtterance("pay €30 to Sam")).toMatchObject({ amount: 30, recipient: "Sam" });
    expect(parseUtterance("send 20 euros to Anita")).toMatchObject({
      amount: 20,
      recipient: "Anita",
    });
    expect(parseUtterance("pay £15 to Karan")).toMatchObject({ amount: 15, recipient: "Karan" });
  });

  it("parses decimals", () => {
    expect(parseUtterance("pay 99.50 to Nisha")).toMatchObject({
      amount: 99.5,
      recipient: "Nisha",
    });
  });

  it("is case-insensitive on verbs", () => {
    expect(parseUtterance("PAY 500 TO JANHVI")).toMatchObject({
      amount: 500,
      recipient: "JANHVI",
    });
  });

  it("returns empty for non-payments", () => {
    expect(parseUtterance("hello world").amount).toBeUndefined();
    expect(parseUtterance("hello world").recipient).toBeUndefined();
  });

  it("returns empty for blank", () => {
    expect(parseUtterance("").amount).toBeUndefined();
  });

  it("parses Spanish pagar / para", () => {
    expect(parseUtterance("pagar 200 a Maria")).toMatchObject({ amount: 200, recipient: "Maria" });
    expect(parseUtterance("enviar 50 para Carlos")).toMatchObject({
      amount: 50,
      recipient: "Carlos",
    });
  });

  it("parses French payer", () => {
    expect(parseUtterance("payer 30 à Sophie")).toMatchObject({
      amount: 30,
      recipient: "Sophie",
    });
  });

  it("parses Hindi-style भेजो", () => {
    expect(parseUtterance("भेजो 100 को Priya")).toMatchObject({
      amount: 100,
      recipient: "Priya",
    });
  });

  it("parses bare amount name (voice shorthand)", () => {
    expect(parseUtterance("500 Janhvi")).toMatchObject({ amount: 500, recipient: "Janhvi" });
  });

  it("converts spoken English amounts", () => {
    expect(parseUtterance("pay five hundred to Janhvi")).toMatchObject({
      amount: 500,
      recipient: "Janhvi",
    });
    expect(parseUtterance("send twenty five to Priya")).toMatchObject({
      amount: 25,
      recipient: "Priya",
    });
    expect(parseUtterance("pay one thousand to Rahul")).toMatchObject({
      amount: 1000,
      recipient: "Rahul",
    });
  });

  it("strips filler / politeness from ASR", () => {
    expect(parseUtterance("um please pay 500 to Janhvi")).toMatchObject({
      amount: 500,
      recipient: "Janhvi",
    });
    expect(parseUtterance("can you send 200 to Anita")).toMatchObject({
      amount: 200,
      recipient: "Anita",
    });
  });

  it("resolves fuzzy contact names", () => {
    const contacts = ["Janhvi", "Priya", "Nike"];
    expect(parseUtterance("pay 500 to Janvi", { contacts })).toMatchObject({
      amount: 500,
      recipient: "Janhvi",
    });
    expect(parseUtterance("pay fifty to nike", { contacts })).toMatchObject({
      amount: 50,
      recipient: "Nike",
    });
  });

  it("uses contact hit even when order is messy", () => {
    const contacts = ["Janhvi", "Adidas"];
    expect(parseUtterance("Janhvi five hundred", { contacts })).toMatchObject({
      amount: 500,
      recipient: "Janhvi",
    });
  });

  it("fixes ASR 'too' → 'to'", () => {
    expect(parseUtterance("pay 40 too Sam")).toMatchObject({ amount: 40, recipient: "Sam" });
  });

  it("strips Hinglish 'bhej dijiye' glued onto the name", () => {
    expect(parseUtterance("pay 1000 rupees to Deepak bhej dijiye")).toMatchObject({
      amount: 1000,
      recipient: "Deepak",
    });
    expect(
      parseUtterance("pay 1000 rupees to Deepak bhej dijiye", { contacts: ["Deepa", "Janhvi"] })
    ).toMatchObject({
      amount: 1000,
      recipient: "Deepa",
    });
  });

  it("parses Hinglish Deepa ko … bhej dijiye", () => {
    expect(
      parseUtterance("Deepa ko 1000 rupees bhej dijiye", { contacts: ["Deepa", "Priya"] })
    ).toMatchObject({
      amount: 1000,
      recipient: "Deepa",
    });
  });

  it("prefers amount next to rupees over stray digits", () => {
    expect(parseUtterance("pay 1000 rupees to Deepa")).toMatchObject({
      amount: 1000,
      recipient: "Deepa",
    });
  });

  it("never sticks on ASR-garbage contact labels", () => {
    const contacts = ["Deepak bhej dijiye", "Janhvi", "Priya", "Meera"];
    expect(parseUtterance("pay 500 to Janhvi", { contacts })).toMatchObject({
      amount: 500,
      recipient: "Janhvi",
    });
    expect(parseUtterance("pay 200 to Priya", { contacts })).toMatchObject({
      amount: 200,
      recipient: "Priya",
    });
    expect(parseUtterance("pay 1000 rupees to Deepa", { contacts }).recipient).not.toBe(
      "Deepak bhej dijiye"
    );
  });
});
