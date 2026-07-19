# Circled — Voice Fallback Discipline (Manual Entry Is Not a Second-Class Path)

## Purpose

Voice is the most demonstrable and the most fragile part of the demo at
the same time. ASR mishears names; amounts get spoken as "five thousand"
in one accent and as an audible "five" plus an inaudible "thousand" in
another; sometimes the mic is muted; sometimes the browser doesn't
expose `SpeechRecognition` at all.

The current design already handles the parse edge cases inside
`parseUtterance` (currency-glued amounts, contact fuzzy match, Hinglish
verb stripping). What it did not enforce at the UI layer was that when
voice can't produce a clean intent, the user has an equally direct path
to type the intent — with no penalty and no hidden UI states.

This document specifies that discipline: **manual entry is always one
tap away from wherever the voice flow left the user, including from the
"couldn't hear that" error state.**

---

## 1. Why "just make voice better" is the wrong framing

Two things are true simultaneously:

1. Voice will keep breaking in some fraction of live runs — accents,
   noise, browser gaps, mic permissions. This is not solvable at the
   parse layer alone.
2. A demo that only recovers by "please try again with voice" fails
   loud in exactly the moment a judge is watching.

So the actual fix is not "harden the parser more" — that work has been
done and continues. The fix is **structural**: every voice-touching
surface must expose a same-affordance-weight manual path, so a user (or
a judge) whose voice failed can complete the intent in the next tap,
not the next demo cycle.

---

## 2. Fallback contract (three entry points, one intent path)

### 2.1 Entry point A — voice trigger tile

The primary tile speaks "Tap to speak — amount and name." Next to it,
with equal visual weight, a **"Type instead"** button opens the same
`PaymentPing` sheet with empty amount and empty recipient, and the
recipient selector already primed to the currently-focused receiver.

Same downstream code path: `confirmPay(edits, receiver)` — the sheet
doesn't know whether the intent came from voice or typing.

### 2.2 Entry point B — voice error state

When voice errors (`no-speech`, `aborted`, low-confidence, missing
amount, missing name), the error card must display the parsed transcript
(if any) and offer three buttons of equal prominence:

```
[ Try voice again ]  [ Type instead ]  [ Switch person ]
```

Not: "please try voice again." The Type button is not tucked into a
secondary action row; it's a first-class option.

### 2.3 Entry point C — no-voice browser fallback

`speechRecognitionAvailable()` returning false is not an error state —
it's a routing decision. The trigger tile becomes a "Type payment"
button by default in that browser, with a small explanatory label:
"Voice needs Chrome or Edge — you can still type."

Result: nothing about the demo requires voice to work.

---

## 3. Parse hardening that the fallback contract makes safe

Because the UI now recovers cleanly from a bad parse, the parser can be
tightened without becoming a demo hazard:

* **Bare number when receiver is selected.** If the receiver chip is
  already selected and the utterance is only a number ("five thousand"),
  treat the number as the amount and the selected receiver as the
  recipient. Previously ambiguous, now safe because the manual path is
  always one tap away if we're wrong.
* **Amount / name transposition.** If both are found but in reverse
  order (`parseUtterance` returns amount = "Maya", recipient = "5000"),
  reject the parse, show the transcript in the ping sheet with editable
  fields, and let the user fix it in place. Do not silently guess.
* **Low-confidence recipient.** If the recipient string doesn't fuzzy
  match any contact and doesn't look like a name (all-digits, all-junk),
  open the ping sheet with the amount pre-filled and the recipient
  empty — the user picks or types the name.

All three of these preserve the single-tap recovery property. None of
them add a new failure mode.

---

## 4. Threat model

| Threat | Mitigation |
|---|---|
| Judge's mic is muted / browser blocks it and the demo goes silent | §2.3 — the tile becomes "Type payment" automatically; no dead state |
| ASR mishears the recipient and pays the wrong contact silently | §3 low-confidence path — parse rejects, ping sheet opens with editable name; existing PaymentPing confirmation still gates the settle |
| ASR mishears amount by an order of magnitude (₹5,000 → ₹50,000) | Amount is always shown in the ping sheet before settle; user must confirm; policy T2 second-Accept still triggers at the existing threshold |
| User taps "Type instead" mid-listening and voice keeps running in background | `startVoice` returns a handle stored in `voiceRef`; the type path calls `voiceRef.current?.stop()` before opening the sheet |
| Fallback UI itself becomes a wall of buttons and confuses first-time users | The three buttons in §2.2 are the only additions — everything else uses the existing PaymentPing surface; the affordance count on the home tile does not grow |
| Parse hardening in §3 makes an over-eager guess (e.g. bare-number rule fires when user wanted to pay someone else) | The rule only fires when the receiver chip is selected; the ping sheet still opens and requires confirmation; nothing settles without a second tap |

---

## 5. Scaling / operational note

The fallback contract is a UI-layer discipline, not a service. Nothing
in it needs shard-level design. Two operational items are called out:

* **Telemetry.** Emit a per-run tag for `intent_entry = voice | type |
  voice_then_edited` so ops can see, at pilot scale, how often voice
  actually carries the intent end-to-end vs how often the type path
  recovers it. This is the number that decides whether to invest more
  in ASR at the next pilot.
* **Locale.** The bare-number rule (§3) needs to know the current
  display currency so "five thousand rupees" and "five hundred dollars"
  don't collide. That reuses `getDisplayCurrency()` — no new state.

This is not a scaling concern in the shard-service sense; it's a
product-metrics concern, and it's flagged rather than solved here.
