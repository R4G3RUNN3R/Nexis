# Automated Command Gateway Contract

Status: Foundation contract and executable shape guards exist. No real gateway implementation or
caller exists yet. This document is the binding behavioural acceptance contract for the first real
implementation; it does not claim that runtime enforcement is complete.

## Boundary invariant

The trusted Application/execution composition root supplies a reviewed, non-empty
`ISystemActorRegistry`. `SystemActorKey` remains a historical value type: recovery and replay may
rehydrate a retired key without consulting the current registry. Closed-set validation happens only
when a new automated command enters through `IAutomatedCommandGateway`.

`IAutomatedCommandGateway.SubmitAsync` intentionally returns
`ValueTask<AutomatedCommandSubmissionResult>` instead of `ValueTask`. This is a deliberate public
contract change made before any implementation or caller exists, so identity rejection is explicit
and cannot be mistaken for accepted work.

## Required acceptance tests for the first real gateway

The implementation is not releasable until all five tests run against its real composition and the
real disposable PostgreSQL receipt store. None may be replaced by reflection-only tests or mocks of
the receipt repository.

1. `UnregisteredSystemActorKey_IsRejectedByTheGatewayBeforeAnyReceiptExists`
   - Submit a well-formed request whose key is absent from the configured registry.
   - Assert `UnregisteredSystemActor` is returned.
   - Assert no `command_receipts` row exists for the CommandId.
   - Assert exactly one durable `AutomationIdentityRejected` signal with Critical severity and
     reason `automation.unregistered_system_actor` exists for the attempt correlation.
2. `RegisteredSystemActorKey_IsAcceptedAndAppearsVerbatimInTheDurableReceipt`
   - Submit through the real gateway with a registered normalized key.
   - Assert `Accepted` and one receipt whose `actor_system_key` equals that normalized key.
3. `SchedulerAndCielKeysRemainDistinctThroughTheGateway`
   - Submit otherwise equivalent requests under two separately registered authorities.
   - Assert distinct receipt actor identities and no cross-authority duplicate result.
4. `RetiredSystemActorKey_CanStillBeRehydratedByRecoveryAndReplay`
   - Rehydrate historical execution evidence containing a syntactically valid key absent from the
     current registry.
   - Assert recovery/replay representation succeeds without admitting a new ingress command.
5. `UnregisteredKeyRejection_DoesNotEchoTheRejectedValueIntoAnUnboundedLabel`
   - Use a unique rejected-key sentinel.
   - Assert no signal reason, component, serialized payload, exception text, or other unbounded
     operational label contains the sentinel. Correlation and a bounded pseudonymous discriminator
     may be used for investigation.

The registry lookup and rejection signal must occur before receipt acquisition. Cancellation and
signal-sink failure handling must follow the command-execution and operational-observability
contracts; neither may silently convert a rejected authority into accepted work.
