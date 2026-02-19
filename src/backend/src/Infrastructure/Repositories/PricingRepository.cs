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
    private readonly object _syncLock = new();
    private PricingCatalog? _cache;

    public PricingRepository(IHostEnvironment env, ILogger<PricingRepository> logger)
    {
        _env = env;
        _logger = logger;
    }

    public PricingCatalog GetCatalog()
    {
        lock (_syncLock)
        {
            if (_cache is not null)
            {
                return _cache;
            }

            var fullPath = GetCatalogPath();

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

    public PricingCatalog SaveCatalog(PricingCatalog catalog)
    {
        lock (_syncLock)
        {
            var fullPath = GetCatalogPath();
            var directory = Path.GetDirectoryName(fullPath)
                ?? throw new InvalidOperationException("No se pudo determinar el directorio del catálogo de precios.");

            Directory.CreateDirectory(directory);

            var json = JsonSerializer.Serialize(catalog, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                WriteIndented = true
            });

            File.WriteAllText(fullPath, json);
            _cache = catalog;
            _logger.LogInformation("Catálogo de pricing actualizado en {Path}", fullPath);

            return _cache;
        }
    }

    private string GetCatalogPath()
    {
        var path = Path.Combine(_env.ContentRootPath, "data", "pricing.json");
        return Path.GetFullPath(path);
    }
}

 