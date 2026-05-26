FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

RUN mkdir -p src/PasswordManagerAPI
RUN mkdir -p src/Security

COPY PasswordManagerAPI/PasswordManagerAPI.csproj src/PasswordManagerAPI/
COPY Security/Security.csproj src/Security/

RUN dotnet restore src/PasswordManagerAPI/PasswordManagerAPI.csproj

COPY PasswordManagerAPI src/PasswordManagerAPI
COPY Security src/Security

WORKDIR /src/src/PasswordManagerAPI

RUN dotnet publish -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app

COPY --from=build /app/publish .

EXPOSE 8080
EXPOSE 8443

ENTRYPOINT ["dotnet","PasswordManagerAPI.dll"]
