/**
 * Off-ramp stub — mocked withdraw-to-bank for demo money-out story.
 */
export type OfframpRequest = {
  amount: number;
  currency: string;
  accountHint: string;
};

export type OfframpResult = {
  ok: true;
  status: "queued" | "mock_settled";
  reference: string;
  etaMinutes: number;
  note: string;
};

export async function requestOfframp(input: OfframpRequest): Promise<OfframpResult> {
  const res = await fetch("/api/offramp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || data.reason || "Off-ramp failed");
  }
  return data as OfframpResult;
}
