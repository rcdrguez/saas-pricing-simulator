using System.Text.Json;
using Application.Interfaces;
using Domain.Entities;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System.IO;

namespace Infrastructure.Repositories;

public class PricingRepository : IPricingRepository
{
    private readonly IHostEnvironment _env;
    private readonly ILogger<PricingRepository> _logger;
    private PricingCatalog? _cache;

    public PricingRepository(IHostEnvironment env, ILogger<PricingRepository> logger)
    {
        _env = env;
        _logger = logger;
    }

    public PricingCatalog GetCatalog()
    {
        if (_cache is not null)
        {
            return _cache;
        }

        var path = Path.Combine(_env.ContentRootPath, "..", "Infrastructure", "data", "pricing.json");
        var fullPath = Path.GetFullPath(path);

        if (!File.Exists(fullPath))
        {
            throw new FileNotFoundException($"No se encontró pricing.json en {fullPath}");
        }

        var json = File.ReadAllText(fullPath);
        _cache = JsonSerializer.Deserialize<PricingCatalog>(json, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        }) ?? throw new InvalidOperationException("No se pudo deserializar pricing.json");

        _logger.LogInformation("Catálogo de pricing cargado desde {Path}", fullPath);
        return _cache;
    }
}
