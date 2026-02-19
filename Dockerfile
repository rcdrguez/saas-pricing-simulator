FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy project files first for better layer cache
COPY src/backend/saas-pricing-simulator.sln src/backend/
COPY src/backend/src/Api/Api.csproj src/backend/src/Api/
COPY src/backend/src/Application/Application.csproj src/backend/src/Application/
COPY src/backend/src/Domain/Domain.csproj src/backend/src/Domain/
COPY src/backend/src/Infrastructure/Infrastructure.csproj src/backend/src/Infrastructure/

RUN dotnet restore src/backend/src/Api/Api.csproj

# Copy the rest of the source
COPY . .
RUN dotnet publish src/backend/src/Api/Api.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

# Render injects PORT dynamically
ENV ASPNETCORE_URLS=http://0.0.0.0:${PORT}
EXPOSE 10000

ENTRYPOINT ["dotnet", "Api.dll"]
