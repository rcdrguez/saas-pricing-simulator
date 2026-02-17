using System.ComponentModel.DataAnnotations;

namespace Application.DTOs;

public class CompanyInfoRequest
{
    [Required]
    public string Name { get; set; } = string.Empty;

    [RegularExpression("^$|^[0-9]{9,11}$", ErrorMessage = "rnc debe tener entre 9 y 11 dígitos numéricos.")]
    public string? Rnc { get; set; }

    public string? Address { get; set; }
    public string? Phone { get; set; }

    [EmailAddress]
    public string? Email { get; set; }

    [Url]
    public string? Website { get; set; }

    [RegularExpression("^(USD|DOP)$", ErrorMessage = "currency debe ser USD o DOP.")]
    public string Currency { get; set; } = "USD";

    public string? LegalNotes { get; set; }
    public string? LogoBase64 { get; set; }
}

public class CustomerInfoRequest
{
    [Required]
    public string Name { get; set; } = string.Empty;

    public string? Company { get; set; }

    [EmailAddress]
    public string? Email { get; set; }

    public string? Phone { get; set; }
    public string? Address { get; set; }
}

public class QuoteDocumentInfoRequest
{
    [Required]
    public string QuoteNumber { get; set; } = string.Empty;

    [Required]
    public DateOnly IssueDate { get; set; }

    [Range(1, 365)]
    public int ValidDays { get; set; } = 15;

    public string? Notes { get; set; }

    [Required]
    public QuoteRequest PricingRequest { get; set; } = new();
}

public class QuotePdfRequest
{
    [Required]
    public CompanyInfoRequest Company { get; set; } = new();

    [Required]
    public CustomerInfoRequest Customer { get; set; } = new();

    [Required]
    public QuoteDocumentInfoRequest Quote { get; set; } = new();
}
