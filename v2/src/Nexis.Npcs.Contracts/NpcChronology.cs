namespace Nexis.Npcs.Contracts;

public static class NpcChronology
{
    public static int CalculateChronologicalAge(
        DateTimeOffset birthInstantUtc,
        DateTimeOffset atUtc)
    {
        if (birthInstantUtc.Offset != TimeSpan.Zero)
        {
            throw new ArgumentException("NPC birth instant must be UTC.", nameof(birthInstantUtc));
        }

        if (atUtc.Offset != TimeSpan.Zero)
        {
            throw new ArgumentException("NPC age evaluation time must be UTC.", nameof(atUtc));
        }

        if (atUtc < birthInstantUtc)
        {
            throw new ArgumentOutOfRangeException(nameof(atUtc), "NPC age cannot be evaluated before birth.");
        }

        var years = atUtc.Year - birthInstantUtc.Year;
        if (birthInstantUtc.AddYears(years) > atUtc)
        {
            years--;
        }

        return years;
    }
}
