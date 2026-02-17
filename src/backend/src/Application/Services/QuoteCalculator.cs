using Application.DTOs;
using Domain.Entities;

namespace Application.Services;

public class QuoteCalculator
{
    public QuoteResponse Calculate(QuoteRequest request, PricingCatalog catalog)
    {
        var plan = catalog.Planes.FirstOrDefault(p => p.Id == request.PlanId)
            ?? throw new InvalidOperationException($"No existe plan con id '{request.PlanId}'.");

        var addons = catalog.Addons.Where(a => request.AddonIds.Contains(a.Id)).ToList();

        if (addons.Count != request.AddonIds.Distinct().Count())
        {
            throw new InvalidOperationException("Uno o más add-ons no existen.");
        }

        var items = new List<QuoteItem>();
        decimal subtotal = 0;

        items.Add(new($"Plan base ({plan.Nombre})", plan.PrecioBaseMensual));
        subtotal += plan.PrecioBaseMensual;

        var extraUsers = Math.Max(0, request.Users - plan.UsuariosIncluidos);
        var extraUserPrice = plan.CostoPorUsuarioMensual ?? catalog.Reglas.CostoPorUsuarioMensual;
        if (extraUsers > 0)
        {
            var amount = extraUsers * extraUserPrice;
            items.Add(new($"Usuarios extra ({extraUsers} x ${extraUserPrice:0.##})", amount));
            subtotal += amount;
        }

        var storageUnits = (int)Math.Ceiling(request.ExtraStorageGb / 100m);
        if (storageUnits > 0)
        {
            var amount = storageUnits * catalog.Reglas.CostoPor100GbMensual;
            items.Add(new($"Storage extra ({storageUnits} x 100GB)", amount));
            subtotal += amount;
        }

        foreach (var addon in addons)
        {
            decimal amount = addon.Tipo == "per_unit" ? addon.Precio * request.Users : addon.Precio;
            items.Add(new($"Add-on: {addon.Nombre}", amount));
            subtotal += amount;
        }

        decimal factorProrrateo = request.ProrationDays > 0 ? request.ProrationDays / 30m : 1m;
        if (factorProrrateo != 1m)
        {
            subtotal *= factorProrrateo;
        }

        var discounts = new List<QuoteItem>();
        decimal runningSubtotal = subtotal;

        if (request.BillingCycle == "annual")
        {
            var discount = Round2(runningSubtotal * 0.10m);
            runningSubtotal -= discount;
            discounts.Add(new("Descuento anual (10%)", -discount));
        }

        decimal volumeDiscountRate = request.Users switch
        {
            >= 100 => 0.15m,
            >= 50 => 0.10m,
            >= 25 => 0.05m,
            _ => 0m
        };

        if (volumeDiscountRate > 0)
        {
            var discount = Round2(runningSubtotal * volumeDiscountRate);
            runningSubtotal -= discount;
            discounts.Add(new($"Descuento por volumen ({volumeDiscountRate:P0})", -discount));
        }

        runningSubtotal = Round2(runningSubtotal);
        var tax = Round2(runningSubtotal * request.TaxRate);
        var total = Round2(runningSubtotal + tax);

        return new QuoteResponse
        {
            Currency = catalog.Currency,
            Plan = plan,
            BillingCycle = request.BillingCycle,
            Items = items.Select(i => i with { Amount = Round2(i.Amount) }).ToList(),
            Subtotal = Round2(subtotal),
            Discounts = discounts,
            DiscountTotal = Round2(discounts.Sum(d => d.Amount)),
            SubtotalAfterDiscounts = runningSubtotal,
            Tax = tax,
            Total = total,
            Meta = new
            {
                includedUsers = plan.UsuariosIncluidos,
                extraUsers,
                unitPrices = new
                {
                    extraUserMonthly = extraUserPrice,
                    per100GbMonthly = catalog.Reglas.CostoPor100GbMensual
                }
            }
        };
    }

    private static decimal Round2(decimal amount) => Math.Round(amount, 2, MidpointRounding.AwayFromZero);
}
