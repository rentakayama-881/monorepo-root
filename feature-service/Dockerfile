# ─── Stage 1: Build ───────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build

WORKDIR /src
COPY src/FeatureService.Api/FeatureService.Api.csproj src/FeatureService.Api/
RUN dotnet restore src/FeatureService.Api/FeatureService.Api.csproj

COPY src/ src/
RUN dotnet publish src/FeatureService.Api/FeatureService.Api.csproj \
    -c Release -o /app/publish --no-restore

# ─── Stage 2: Runtime ─────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:5000
ENV ASPNETCORE_ENVIRONMENT=Production

EXPOSE 5000

HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

USER $APP_UID

ENTRYPOINT ["dotnet", "FeatureService.Api.dll"]
