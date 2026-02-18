using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class GenerateController : ControllerBase
{
    private readonly IHttpClientFactory _httpClientFactory;

    public GenerateController(IHttpClientFactory httpClientFactory)
    {
        _httpClientFactory = httpClientFactory;
    }

    [HttpPost]
    public async Task<ActionResult<GenerateResponse>> GenerateAsync([FromBody] GenerateRequest request, CancellationToken cancellationToken)
    {
        if (request.OnlineMode && !string.IsNullOrWhiteSpace(request.ApiKey))
        {
            try
            {
                var onlineText = request.Provider?.ToLowerInvariant() == "gemini"
                    ? await CallGeminiAsync(request, cancellationToken)
                    : await CallOpenAiAsync(request, cancellationToken);

                if (!string.IsNullOrWhiteSpace(onlineText))
                {
                    return Ok(new GenerateResponse(
                        onlineText,
                        "online",
                        request.Provider?.ToLowerInvariant() == "gemini" ? "gemini" : "openai",
                        null));
                }
            }
            catch
            {
                // Degradar a mock para demos resilientes.
            }
        }

        return Ok(new GenerateResponse(
            BuildMockInsight(request.Quote),
            "mock",
            "mock",
            "No se pudo usar el proveedor online; se devolvió una respuesta simulada."));
    }

    private async Task<string> CallOpenAiAsync(GenerateRequest request, CancellationToken cancellationToken)
    {
        using var client = _httpClientFactory.CreateClient();
        using var message = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/chat/completions");
        message.Headers.Authorization = new AuthenticationHeaderValue("Bearer", request.ApiKey);

        var payload = new
        {
            model = "gpt-4o-mini",
            temperature = 0.35,
            messages = new[]
            {
                new { role = "system", content = "Eres un ejecutivo de ventas SaaS. Entrega una explicación clara, breve y accionable en español." },
                new { role = "user", content = BuildPrompt(request.Quote) }
            }
        };

        message.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
        using var response = await client.SendAsync(message, cancellationToken);
        if (!response.IsSuccessStatusCode) throw new InvalidOperationException("OpenAI request failed.");

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var json = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
        return json.RootElement
            .GetProperty("choices")[0]
            .GetProperty("message")
            .GetProperty("content")
            .GetString()
            ?.Trim() ?? string.Empty;
    }

    private async Task<string> CallGeminiAsync(GenerateRequest request, CancellationToken cancellationToken)
    {
        var uri = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={Uri.EscapeDataString(request.ApiKey!)}";

        using var client = _httpClientFactory.CreateClient();
        var payload = new
        {
            contents = new[]
            {
                new
                {
                    parts = new[]
                    {
                        new { text = BuildPrompt(request.Quote) }
                    }
                }
            },
            generationConfig = new
            {
                temperature = 0.35
            }
        };

        using var response = await client.PostAsync(uri,
            new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json"), cancellationToken);

        if (!response.IsSuccessStatusCode) throw new InvalidOperationException("Gemini request failed.");

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var json = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
        return json.RootElement
            .GetProperty("candidates")[0]
            .GetProperty("content")
            .GetProperty("parts")[0]
            .GetProperty("text")
            .GetString()
            ?.Trim() ?? string.Empty;
    }

    private static string BuildPrompt(QuoteSummary quote)
    {
        var addons = quote.Addons.Count == 0 ? "ninguno" : string.Join(", ", quote.Addons);
        var topItem = quote.TopItemLabel ?? "base del plan";

        return $"""
Resume la siguiente cotización SaaS con enfoque comercial.
- Cliente: {quote.CustomerName}
- Plan: {quote.PlanName}
- Usuarios: {quote.Users}
- Add-ons: {addons}
- Ciclo: {quote.BillingCycle}
- Subtotal: {quote.Subtotal} {quote.Currency}
- Impuestos: {quote.Tax} {quote.Currency}
- Total: {quote.Total} {quote.Currency}
- Rubro de mayor impacto: {topItem}
- ¿Tiene descuentos?: {(quote.HasDiscounts ? "sí" : "no")}
- ¿Tiene prorrateo?: {(quote.HasProration ? "sí" : "no")}

Devuelve 1 párrafo útil para un ejecutivo de ventas, en español, sin formato markdown.
""";
    }

    private static string BuildMockInsight(QuoteSummary quote)
    {
        var addonsText = quote.Addons.Count == 0 ? "sin add-ons" : $"con add-ons ({string.Join(", ", quote.Addons)})";
        var cadence = quote.BillingCycle == "annual" ? "anual" : "mensual";

        return $"Propuesta simulada: para {quote.CustomerName}, recomendamos el plan {quote.PlanName} para {quote.Users} usuario(s), {addonsText}, con facturación {cadence}. El total estimado es {quote.Total:F2} {quote.Currency} y el principal componente de costo es {quote.TopItemLabel ?? "la base del plan"}. Esta versión está en Mock mode para mantener la demo operativa.";
    }
}

public record GenerateRequest(bool OnlineMode, string Provider, string? ApiKey, QuoteSummary Quote);

public record QuoteSummary(
    string CustomerName,
    string PlanName,
    int Users,
    List<string> Addons,
    string BillingCycle,
    decimal Subtotal,
    decimal Tax,
    decimal Total,
    string Currency,
    string? TopItemLabel,
    bool HasDiscounts,
    bool HasProration);

public record GenerateResponse(string Text, string ModeUsed, string ProviderUsed, string? Warning);
