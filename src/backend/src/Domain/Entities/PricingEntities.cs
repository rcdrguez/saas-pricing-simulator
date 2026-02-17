namespace Domain.Entities;

public record Plan(string Id, string Nombre, decimal PrecioBaseMensual, int UsuariosIncluidos, int StorageIncluidoGb, decimal? CostoPorUsuarioMensual = null);

public record Addon(string Id, string Nombre, string Tipo, decimal Precio);

public record PricingRules(decimal CostoPorUsuarioMensual, decimal CostoPor100GbMensual);

public record PricingCatalog(string Currency, List<Plan> Planes, List<Addon> Addons, PricingRules Reglas);
