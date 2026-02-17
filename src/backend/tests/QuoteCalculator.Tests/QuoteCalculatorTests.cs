using System.Collections.Generic;
using Application.DTOs;
using Application.Services;
using Domain.Entities;
using Xunit;

namespace QuoteCalculatorTests
{
    public class QuoteCalculatorTests
    {
        private readonly QuoteCalculator _calculator = new();

        private static PricingCatalog Catalog => new(
            "USD",
            new List<Plan>
            {
                new Plan("starter", "Starter", 19m, 3, 50),
                new Plan("pro", "Pro", 49m, 10, 200, 6m),
                new Plan("business", "Business", 129m, 25, 1000, 5m)
            },
            new List<Addon>
            {
                new Addon("support_premium", "Soporte premium", "flat", 149m),
                new Addon("api_calls_pack", "Pack API calls", "per_unit", 1.2m)
            },
            new PricingRules(8m, 10m)
        );

        [Fact]
        public void Calcula_Descuento_Anual()
        {
            var req = BaseRequest();
            req.BillingCycle = "annual";
            var result = _calculator.Calculate(req, Catalog);
            Assert.Contains(result.Discounts, d => d.Label.Contains("anual"));
        }

        [Fact]
        public void Calcula_Descuento_Volumen_50()
        {
            var req = BaseRequest();
            req.Users = 50;
            var result = _calculator.Calculate(req, Catalog);
            Assert.Contains(result.Discounts, d => d.Label.Contains("10%"));
        }

        [Fact]
        public void Calcula_Impuesto_Correctamente()
        {
            var req = BaseRequest();
            req.TaxRate = 0.18m;
            var result = _calculator.Calculate(req, Catalog);
            Assert.True(result.Tax > 0);
        }

        [Fact]
        public void Calcula_Prorrateo()
        {
            var full = _calculator.Calculate(BaseRequest(), Catalog);
            var proratedReq = BaseRequest();
            proratedReq.ProrationDays = 15;
            var prorated = _calculator.Calculate(proratedReq, Catalog);
            Assert.True(prorated.Subtotal < full.Subtotal);
        }

        [Fact]
        public void Falla_Con_Plan_Invalido()
        {
            var req = BaseRequest();
            req.PlanId = "nope";
            Assert.Throws<InvalidOperationException>(() => _calculator.Calculate(req, Catalog));
        }

        [Fact]
        public void Calcula_Addon_PerUnit()
        {
            var req = BaseRequest();
            req.AddonIds = new List<string> { "api_calls_pack" };
            var result = _calculator.Calculate(req, Catalog);
            Assert.Contains(result.Items, i => i.Label.Contains("Pack API calls") && i.Amount > 0);
        }

        [Fact]
        public void Aplica_Descuento_Volumen_100()
        {
            var req = BaseRequest();
            req.Users = 120;
            var result = _calculator.Calculate(req, Catalog);
            Assert.Contains(result.Discounts, d => d.Label.Contains("15%"));
        }

        private static QuoteRequest BaseRequest() => new()
        {
            PlanId = "pro",
            Users = 18,
            ExtraStorageGb = 200,
            AddonIds = new List<string> { "support_premium" },
            BillingCycle = "monthly",
            TaxRate = 0.18m,
            ProrationDays = 0
        };
    }
}
