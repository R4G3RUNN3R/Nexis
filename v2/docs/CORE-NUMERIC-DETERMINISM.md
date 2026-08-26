# Nexis Core Numeric Determinism

_Status: foundation implementation policy, 2026-08-26. Subordinate to `CORE-ARCHITECTURE.md`, `ENGINEERING-MANUAL.md` and versioned gameplay rule specifications._

## Purpose

A replaceable Core must produce the same authoritative result from the same compatible state, intent, rule/content versions, time and RNG inputs even when the implementation language/runtime changes.

Numeric ambiguity is therefore an architecture defect, not merely a balancing issue.

## Default numeric policy

For authoritative gameplay calculations:

- prefer integral state and exact integer/rational arithmetic;
- use explicit numerator/denominator ratios or domain-specific scaled integers for percentages, multipliers and probabilities;
- use wide intermediate arithmetic so valid results are not lost to premature overflow;
- use checked narrowing/conversions so overflow becomes an explicit technical failure instead of silent wraparound;
- require an explicit rounding mode whenever division can produce a remainder;
- define the rounding point in the versioned rule, not implicitly in a UI/client or persistence adapter;
- keep presentation formatting separate from authoritative calculations.

The concrete C# Core foundation implements this policy with `Int128` intermediates and `DeterministicIntegerMath.MultiplyDivide`.

## Floating-point rule

`float`, `double` and `Half` are not permitted as the default representation for authoritative gameplay state, contract fields, rewards, damage, resource costs, probabilities or other rule outputs.

They remain acceptable for non-authoritative concerns such as UI animation, visual interpolation, charts or operational telemetry where exact replay equality is not a gameplay invariant.

If a future authoritative rule genuinely requires floating/transcendental mathematics, that rule must define a versioned algorithm, normalization/rounding semantics and conformance vectors before implementation. Calling `Math.Pow`, `Math.Sin` or similar runtime functions directly and assuming another future Core will match is not sufficient.

`decimal` is also not an automatic cross-runtime escape hatch. It may be introduced for an authoritative domain only when its scale, range, rounding, serialization and cross-runtime compatibility are explicitly specified and covered by conformance tests.

## Rounding modes

The reference Core exposes these explicit rounding strategies internally:

- `TowardZero`;
- `AwayFromZero`;
- `Floor`;
- `Ceiling`;
- `ToNearestEven`;
- `ToNearestAwayFromZero`.

There is no global rule that one mode is always correct. Each versioned gameplay formula selects the mode that matches its intended semantics.

Examples:

- a damage floor may deliberately round down;
- a minimum guaranteed cost may deliberately round up;
- a neutral long-running statistical formula may choose nearest-even;
- a legacy rule may preserve a historically established mode for replay compatibility.

Changing a formula's rounding mode is a gameplay rule change and therefore requires a new rule/formula version where historical compatibility matters.

## Overflow policy

Authoritative arithmetic must not silently wrap.

The reference helper uses an `Int128` intermediate for multiplication of `long` inputs and performs a checked conversion back to `long`. A result outside the declared output range throws rather than becoming another valid-looking number.

Overflow indicates one of:

- invalid/corrupt input;
- an unsafe content definition;
- an unsupported range;
- a programming defect;
- a deliberate future need to widen the contract/state type.

It is not an in-world random failure and must not be converted into gameplay loss/reward merely to keep execution moving.

## Cross-runtime replacement requirement

A future Rust, Go, C++, separate-process or otherwise different Core does not need to reproduce C# implementation details. It does need to reproduce the versioned mathematical semantics.

For every material formula family, conformance scenarios should include:

- exact divisions;
- positive and negative non-exact divisions where applicable;
- midpoint/tie behavior;
- zero and boundary values;
- maximum supported values;
- overflow/rejection cases;
- known historical edge cases;
- any formula-specific conservation/invariant checks.

The conformance harness compares authoritative semantic results, making the mathematical contract portable even when the implementation is not.

## Scope of this slice

This foundation deliberately does not choose Nexis balancing values.

It does not decide:

- combat damage coefficients;
- the Inn `+50%` defensive modifier implementation details beyond requiring exact arithmetic when that system is later implemented;
- XP curves;
- Energy regeneration values;
- crafting quality formulas;
- economy prices;
- cooldown-reduction caps;
- probability tables.

Those remain gameplay design/rule-version work. This policy only ensures that once a value/formula is approved, Core executes it predictably and replaceably.

## Verification status

The numeric helper and tests require restore/build/test execution on the pinned .NET 10 environment before they are considered verified. Static review and external documentation research do not replace compilation/test evidence.
