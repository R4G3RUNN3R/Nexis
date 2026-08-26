namespace Nexis.Core.Contracts;

public readonly record struct CoreContractVersion
{
    public static CoreContractVersion V1 { get; } = new(1);

    public CoreContractVersion(int value)
    {
        if (value <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(value), "Core contract versions must be positive.");
        }

        Value = value;
    }

    public int Value { get; }

    public override string ToString() => Value.ToString();
}

public sealed record RuleVersion
{
    public RuleVersion(string value)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value);
        Value = value;
    }

    public string Value { get; }

    public override string ToString() => Value;
}

public sealed record ContentVersion
{
    public ContentVersion(string value)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value);
        Value = value;
    }

    public string Value { get; }

    public override string ToString() => Value;
}

public sealed record CoreImplementationDescriptor
{
    public CoreImplementationDescriptor(
        string implementationName,
        string implementationVersion,
        CoreContractVersion contractVersion)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(implementationName);
        ArgumentException.ThrowIfNullOrWhiteSpace(implementationVersion);

        ImplementationName = implementationName;
        ImplementationVersion = implementationVersion;
        ContractVersion = contractVersion;
    }

    public string ImplementationName { get; }

    public string ImplementationVersion { get; }

    public CoreContractVersion ContractVersion { get; }
}
