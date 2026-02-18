using Application.Interfaces;
using Domain.Entities;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Route("api/pricing")]
public class PricingController : ControllerBase
{
    private readonly IPricingRepository _repository;

    public PricingController(IPricingRepository repository)
    {
        _repository = repository;
    }

    [HttpGet]
    public IActionResult GetCatalog()
    {
        return Ok(_repository.GetCatalog());
    }

    [HttpPut]
    public IActionResult UpdateCatalog([FromBody] PricingCatalog catalog)
    {
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        if (string.IsNullOrWhiteSpace(catalog.Currency))
        {
            return BadRequest("La moneda es requerida.");
        }

        if (catalog.Planes.Count == 0)
        {
            return BadRequest("Debe existir al menos un plan.");
        }

        var updatedCatalog = _repository.SaveCatalog(catalog);
        return Ok(updatedCatalog);
    }
}
