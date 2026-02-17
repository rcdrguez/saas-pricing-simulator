using Application.DTOs;
using Application.Interfaces;
using Application.Services;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Route("api/quote")]
public class QuoteController : ControllerBase
{
    private readonly QuoteCalculator _calculator;
    private readonly IPricingRepository _repository;

    public QuoteController(QuoteCalculator calculator, IPricingRepository repository)
    {
        _calculator = calculator;
        _repository = repository;
    }

    [HttpPost]
    public IActionResult Calculate([FromBody] QuoteRequest request)
    {
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        var response = _calculator.Calculate(request, _repository.GetCatalog());
        return Ok(response);
    }
}
