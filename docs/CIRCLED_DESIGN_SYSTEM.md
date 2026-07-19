# Circled design system exceptions

## Identity resolution

Circled's normal payment surface remains icon-only. Identity resolution is the
single scoped exception allowed to show explanatory text and a short list,
because safely distinguishing people cannot be reduced to iconography.

This exception applies only to `DisambiguationFlow` and its child components:
`CandidateList`, `CandidateRow`, `ProximityHandoff`, and `NoSafeMatch`. It is not
precedent for adding text-heavy controls or lists elsewhere in the product.

The list reveals only request-scoped, opted-in hints. It must never show an
address, legal identity, online status, or non-response state. A single safe
match bypasses this UI; unresolved requests refuse rather than guess.