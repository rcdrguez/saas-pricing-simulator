using System.ComponentModel.DataAnnotations;
using Domain.Entities;

namespace Application.DTOs;

public class QuoteRequest
{
    [Required]
    public string PlanId { get; set; } = string.Empty;

    [Range(1, 10000)]
    public int Users { get; set; }

    [Range(0, 100000)]
    public int ExtraStorageGb { get; set; }

    public List<string> AddonIds { get; set; } = [];

    [RegularExpression("^(monthly|annual)$", ErrorMessage = "billingCycle debe ser 'monthly' o 'annual'.")]
    public string BillingCycle { get; set; } = "monthly";

    [Range(0, 0.25)]
    public decimal TaxRate { get; set; }

    [Range(0, 30)]
    public int ProrationDays { get; set; }
}

public record QuoteItem(string Label, decimal Amount);

public class QuoteResponse
{
    public string Currency { get; set; } = "USD";
    public Plan? Plan { get; set; }
    public string BillingCycle { get; set; } = "monthly";
    public List<QuoteItem> Items { get; set; } = [];
    public List<QuoteItem> Discounts { get; set; } = [];
    public decimal Subtotal { get; set; }
    public decimal DiscountTotal { get; set; }
    public decimal SubtotalAfterDiscounts { get; set; }
    public decimal Tax { get; set; }
    public decimal Total { get; set; }
    public object? Meta { get; set; }
}
