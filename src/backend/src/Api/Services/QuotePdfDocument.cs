using Application.DTOs;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Api.Services;

public class QuotePdfDocument : IDocument
{
    private readonly QuotePdfRequest _request;
    private readonly QuoteResponse _quote;

    public QuotePdfDocument(QuotePdfRequest request, QuoteResponse quote)
    {
        _request = request;
        _quote = quote;
    }

    public DocumentMetadata GetMetadata() => DocumentMetadata.Default;

    public void Compose(IDocumentContainer container)
    {
        container.Page(page =>
        {
            page.Margin(30);
            page.Size(PageSizes.A4);
            page.DefaultTextStyle(x => x.FontSize(10));

            page.Header().Element(ComposeHeader);
            page.Content().Element(ComposeContent);
            page.Footer().AlignCenter().Text(text =>
            {
                text.Span($"Generado: {DateTime.Now:yyyy-MM-dd HH:mm} · Página ");
                text.CurrentPageNumber();
                text.Span("/");
                text.TotalPages();
            });
        });
    }

    private void ComposeHeader(IContainer container)
    {
        container.Row(row =>
        {
            row.RelativeItem().Column(col =>
            {
                col.Item().Text(_request.Company.Name).FontSize(16).Bold();
                if (!string.IsNullOrWhiteSpace(_request.Company.Rnc))
                    col.Item().Text($"RNC: {_request.Company.Rnc}");
                AddTextIfPresent(col, _request.Company.Address);
                AddTextIfPresent(col, _request.Company.Phone);
                AddTextIfPresent(col, _request.Company.Email);
                AddTextIfPresent(col, _request.Company.Website);
            });

            var logoBytes = TryParseLogo(_request.Company.LogoBase64);
            if (logoBytes is not null)
            {
                row.ConstantItem(100).Height(60).Image(logoBytes, ImageScaling.FitArea);
            }
        });
    }

    private void ComposeContent(IContainer container)
    {
        container.Column(col =>
        {
            col.Spacing(10);
            col.Item().PaddingTop(10).Text($"Cotización #{_request.Quote.QuoteNumber}").FontSize(20).Bold();
            col.Item().Text($"Fecha: {_request.Quote.IssueDate:yyyy-MM-dd}  ·  Validez: {_request.Quote.ValidDays} días");

            col.Item().Border(1).BorderColor(Colors.Grey.Lighten2).Padding(8).Column(c =>
            {
                c.Item().Text("Cliente").Bold();
                c.Item().Text(_request.Customer.Name);
                AddTextIfPresent(c, _request.Customer.Company);
                AddTextIfPresent(c, _request.Customer.Email);
                AddTextIfPresent(c, _request.Customer.Phone);
                AddTextIfPresent(c, _request.Customer.Address);
            });

            col.Item().Table(table =>
            {
                table.ColumnsDefinition(columns =>
                {
                    columns.RelativeColumn();
                    columns.ConstantColumn(120);
                });

                table.Header(header =>
                {
                    header.Cell().Element(CellStyle).Text("Concepto").Bold();
                    header.Cell().Element(CellStyle).AlignRight().Text("Monto").Bold();
                });

                foreach (var item in _quote.Items)
                {
                    table.Cell().Element(CellStyle).Text(item.Label);
                    table.Cell().Element(CellStyle).AlignRight().Text(FormatMoney(item.Amount));
                }
            });

            if (_quote.Discounts.Count > 0)
            {
                col.Item().Text("Descuentos").Bold();
                col.Item().Column(discountCol =>
                {
                    discountCol.Spacing(2);
                    foreach (var discount in _quote.Discounts)
                    {
                        discountCol.Item().Row(row =>
                        {
                            row.RelativeItem().Text(discount.Label);
                            row.ConstantItem(120).AlignRight().Text(FormatMoney(discount.Amount));
                        });
                    }
                });
            }

            col.Item().AlignRight().Width(230).Column(summary =>
            {
                summary.Item().Row(row =>
                {
                    row.RelativeItem().Text("Subtotal");
                    row.ConstantItem(120).AlignRight().Text(FormatMoney(_quote.Subtotal));
                });
                summary.Item().Row(row =>
                {
                    row.RelativeItem().Text("Impuestos");
                    row.ConstantItem(120).AlignRight().Text(FormatMoney(_quote.Tax));
                });
                summary.Item().BorderTop(1).PaddingTop(4).Row(row =>
                {
                    row.RelativeItem().Text("Total").Bold();
                    row.ConstantItem(120).AlignRight().Text(FormatMoney(_quote.Total)).Bold();
                });
            });

            if (!string.IsNullOrWhiteSpace(_request.Quote.Notes))
            {
                col.Item().PaddingTop(4).Text("Notas para el cliente").Bold();
                col.Item().Text(_request.Quote.Notes);
            }

            if (!string.IsNullOrWhiteSpace(_request.Company.LegalNotes))
            {
                col.Item().PaddingTop(4).Text("Notas legales").Bold();
                col.Item().Text(_request.Company.LegalNotes).FontSize(9).FontColor(Colors.Grey.Darken1);
            }
        });
    }

    private IContainer CellStyle(IContainer container)
    {
        return container.BorderBottom(1).BorderColor(Colors.Grey.Lighten2).PaddingVertical(5).PaddingHorizontal(2);
    }

    private string FormatMoney(decimal amount)
    {
        var culture = _request.Company.Currency == "DOP" ? "es-DO" : "en-US";
        return string.Format(System.Globalization.CultureInfo.GetCultureInfo(culture), "{0:C2}", amount);
    }

    private static byte[]? TryParseLogo(string? logoBase64)
    {
        if (string.IsNullOrWhiteSpace(logoBase64))
            return null;

        try
        {
            var base64Part = logoBase64.Contains(',') ? logoBase64.Split(',').Last() : logoBase64;
            return Convert.FromBase64String(base64Part);
        }
        catch
        {
            return null;
        }
    }

    private static void AddTextIfPresent(ColumnDescriptor col, string? value)
    {
        if (!string.IsNullOrWhiteSpace(value))
            col.Item().Text(value);
    }
}
