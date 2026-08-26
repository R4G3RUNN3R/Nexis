var builder = WebApplication.CreateBuilder(args);

builder.Services.AddHealthChecks();

var app = builder.Build();

app.MapGet("/", () => Results.Ok(new
{
    service = "Nexis 2.0",
    status = "foundation",
    authoritative = true
}));

app.MapHealthChecks("/health");

app.Run();

public partial class Program
{
}
