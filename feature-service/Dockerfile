FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 5000

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["src/FeatureService.Api/FeatureService.Api.csproj", "src/FeatureService.Api/"]
RUN dotnet restore "src/FeatureService.Api/FeatureService.Api.csproj"
COPY . .
WORKDIR "/src/src/FeatureService.Api"
RUN dotnet build "FeatureService.Api.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "FeatureService.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "FeatureService.Api.dll"]
