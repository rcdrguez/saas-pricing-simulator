using Application.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Route("api/addons")]
public class AddonsController : ControllerBase
{
    private readonly IPricingRepository _repository;

    public AddonsController(IPricingRepository repository)
    {
        _repository = repository;
    }

    [HttpGet]
    public IActionResult Get()
    {
        return Ok(_repository.GetCatalog().Addons);
    }
}
