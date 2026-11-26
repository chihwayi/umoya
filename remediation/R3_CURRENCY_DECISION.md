# R3 / FX-019 (P-005) — Currency decision: single-currency-per-bill, no FX layer

## Decision

Enforce and validate single-currency-per-bill. No conversion layer ships in
this sprint.

## What is enforced (code)

- `SUPPORTED_CURRENCIES = ['USD', 'ZWL']` in
  `services/ehr-service/src/services/payment-callback-verification.ts`.
- Initiation (`PaymentsService.processMobileMoneyPayment`,
  `MobileMoneyService.initiate`) rejects any other code with 400 — including
  ZiG — rather than recording it.
- Every provider callback must carry an allowlisted currency AND match the
  bill's currency (`billing.currency`); a mismatch rejects with 400 ("no
  silent FX conversion"). Bills without a recorded currency accept any
  allowlisted code.
- No amount is ever multiplied, divided, or re-denominated anywhere in the
  callback path. There is no rate table, no rounding policy, and no fallback
  rate.

## Why not a conversion layer

A real ZiG/USD conversion layer needs a licensed, timestamped rate source,
a rounding/reconciliation policy, and finance sign-off. None of those exist
in this sprint, and a guessed rate would mis-state money — worse than
refusing it. Failing closed (reject ZiG explicitly with a clear error) is
the safe-fail behaviour per §0.5.

## What would unblock ZiG

1. A named, licensed rate source (e.g. RBZ official rate feed) with
   timestamp + source recorded per transaction.
2. A rounding and settlement policy signed off by finance.
3. Tests: same-currency idempotency plus cross-currency fixtures with
   hand-computed expected amounts.

Until then: `NEEDS_FINANCE_REVIEW: ZiG support` — reject, don't convert.

## Test evidence

- `r3-payment-callback-verification.spec.ts` → "callback currency must match
  the bill; unknown codes rejected": a ZiG callback against a USD bill is
  rejected; `SUPPORTED_CURRENCIES` contains USD.
- `payments.service.spec.ts` (stale-test repair) → unsigned callbacks never
  reach the credit path regardless of currency.
