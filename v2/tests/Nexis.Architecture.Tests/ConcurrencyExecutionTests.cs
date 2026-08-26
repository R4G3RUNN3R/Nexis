using Microsoft.VisualStudio.TestTools.UnitTesting;
using Nexis.Core.Contracts;
using Nexis.Execution;
using Nexis.Execution.Contracts;

namespace Nexis.Architecture.Tests;

[TestClass]
public sealed class ConcurrencyExecutionTests
{
    [TestMethod]
    public void OppositeDirectionResources_ProduceIdenticalCanonicalLockOrder()
    {
        var economy = new AuthoritativeResourceKey(new OwnerKey("Economy"), "Wallet", "character-b");
        var inventory = new AuthoritativeResourceKey(new OwnerKey("Inventory"), "Item", "item-a");
        var marketplace = new AuthoritativeResourceKey(new OwnerKey("Marketplace"), "Listing", "listing-c");

        var forward = CanonicalResourceLockOrder.Order(new[] { economy, inventory, marketplace });
        var reverse = CanonicalResourceLockOrder.Order(new[] { marketplace, inventory, economy });

        CollectionAssert.AreEqual(forward.ToArray(), reverse.ToArray());
        CollectionAssert.AreEqual(
            new[] { economy, inventory, marketplace },
            forward.ToArray());
    }

    [TestMethod]
    public void CanonicalLockOrder_DeduplicatesSameResource()
    {
        var key = new AuthoritativeResourceKey(new OwnerKey("Economy"), "Wallet", "character-a");

        var ordered = CanonicalResourceLockOrder.Order(new[] { key, key, key });

        Assert.AreEqual(1, ordered.Count);
        Assert.AreSame(key, ordered[0]);
    }

    [TestMethod]
    public void CanonicalLockOrder_UsesOrdinalStableComparison()
    {
        var lower = new AuthoritativeResourceKey(new OwnerKey("owner"), "Wallet", "1");
        var upper = new AuthoritativeResourceKey(new OwnerKey("Owner"), "Wallet", "1");

        var ordered = CanonicalResourceLockOrder.Order(new[] { lower, upper });

        Assert.AreSame(upper, ordered[0]);
        Assert.AreSame(lower, ordered[1]);
    }

    [TestMethod]
    public async Task RetryExecutor_RerunsWholeAttemptForClassifiedTransientFailure()
    {
        var classifier = new TestFailureClassifier(static exception => exception is RetryableTestException);
        var executor = new BoundedCommandRetryExecutor(classifier, maximumAttempts: 3);
        var attempts = new List<int>();

        var result = await executor.ExecuteAsync<int>((attemptNumber, _) =>
        {
            attempts.Add(attemptNumber);
            if (attemptNumber < 3)
            {
                throw new RetryableTestException();
            }

            return ValueTask.FromResult(42);
        });

        Assert.AreEqual(42, result);
        CollectionAssert.AreEqual(new[] { 1, 2, 3 }, attempts);
    }

    [TestMethod]
    public async Task RetryExecutor_DoesNotRetryPermanentFailure()
    {
        var classifier = new TestFailureClassifier(static exception => exception is RetryableTestException);
        var executor = new BoundedCommandRetryExecutor(classifier, maximumAttempts: 4);
        var attempts = 0;

        await Assert.ThrowsExactlyAsync<InvalidOperationException>(async () =>
        {
            await executor.ExecuteAsync<int>((_, _) =>
            {
                attempts++;
                throw new InvalidOperationException("permanent");
            });
        });

        Assert.AreEqual(1, attempts);
    }

    [TestMethod]
    public async Task RetryExecutor_StopsAtConfiguredMaximumAttempts()
    {
        var classifier = new TestFailureClassifier(static exception => exception is RetryableTestException);
        var executor = new BoundedCommandRetryExecutor(classifier, maximumAttempts: 2);
        var attempts = 0;

        await Assert.ThrowsExactlyAsync<RetryableTestException>(async () =>
        {
            await executor.ExecuteAsync<int>((_, _) =>
            {
                attempts++;
                throw new RetryableTestException();
            });
        });

        Assert.AreEqual(2, attempts);
    }

    [TestMethod]
    public async Task RetryExecutor_NeverRetriesCallerCancellation()
    {
        var classifier = new TestFailureClassifier(static _ => true);
        var executor = new BoundedCommandRetryExecutor(classifier, maximumAttempts: 5);
        using var cancellation = new CancellationTokenSource();
        var attempts = 0;

        await Assert.ThrowsExactlyAsync<OperationCanceledException>(async () =>
        {
            await executor.ExecuteAsync<int>((_, token) =>
            {
                attempts++;
                cancellation.Cancel();
                token.ThrowIfCancellationRequested();
                return ValueTask.FromResult(0);
            }, cancellation.Token);
        });

        Assert.AreEqual(1, attempts);
    }

    private sealed class TestFailureClassifier : ITransientCommandFailureClassifier
    {
        private readonly Func<Exception, bool> _classifier;

        public TestFailureClassifier(Func<Exception, bool> classifier)
        {
            _classifier = classifier;
        }

        public bool IsRetryable(Exception exception) => _classifier(exception);
    }

    private sealed class RetryableTestException : Exception
    {
    }
}
