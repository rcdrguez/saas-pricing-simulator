using Domain.Entities;

namespace Application.Interfaces;

public interface IPricingRepository
{
    PricingCatalog GetCatalog();
    PricingCatalog SaveCatalog(PricingCatalog catalog);
}
