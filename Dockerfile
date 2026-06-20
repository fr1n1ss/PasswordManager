FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY Security/Security.csproj Security/
COPY PasswordManagerAPI/PasswordManagerAPI.csproj PasswordManagerAPI/

RUN dotnet restore PasswordManagerAPI/PasswordManagerAPI.csproj

COPY . .

RUN dotnet publish PasswordManagerAPI/PasswordManagerAPI.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final

WORKDIR /app

COPY --from=build /app/publish .

EXPOSE 8080

ENTRYPOINT ["dotnet", "PasswordManagerAPI.dll"]
