using Api.Services;
using Application.DTOs;
using Application.Interfaces;
using Application.Services;
using Microsoft.AspNetCore.Mvc;
using QuestPDF;
using QuestPDF.Fluent;
using QuestPDF.Infrastructure;

namespace Api.Controllers;

[ApiController]
[Route("api/quotes")]
public class QuotesController : ControllerBase
{
    private readonly QuoteCalculator _calculator;
    private readonly IPricingRepository _repository;

    public QuotesController(QuoteCalculator calculator, IPricingRepository repository)
    {
        _calculator = calculator;
        _repository = repository;
    }

    [HttpPost("pdf")]
    public IActionResult GeneratePdf([FromBody] QuotePdfRequest request)
    {
        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        if (string.IsNullOrWhiteSpace(request.Quote.QuoteNumber))
            return BadRequest("quoteNumber es requerido.");

        if (request.Quote.PricingRequest.Users < 1)
            return BadRequest("users debe ser mayor o igual a 1.");

        if (request.Quote.PricingRequest.TaxRate is < 0 or > 0.25m)
            return BadRequest("taxRate debe estar entre 0 y 0.25.");

        if (request.Quote.PricingRequest.ProrationDays is < 0 or > 30)
            return BadRequest("prorationDays debe estar entre 0 y 30.");

        Settings.License = LicenseType.Community;

        var quoteResponse = _calculator.Calculate(request.Quote.PricingRequest, _repository.GetCatalog());
        var document = new QuotePdfDocument(request, quoteResponse);
        var pdfBytes = document.GeneratePdf();

        var safeNumber = request.Quote.QuoteNumber.Replace("/", "-");
        return File(pdfBytes, "application/pdf", $"Quote_{safeNumber}.pdf");
    }
}
