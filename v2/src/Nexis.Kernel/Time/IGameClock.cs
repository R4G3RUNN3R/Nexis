namespace Nexis.Kernel.Time;

public interface IGameClock
{
    DateTimeOffset UtcNow { get; }
}
