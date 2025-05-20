FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY ./out .
COPY certificate.pfx /app/certificate.pfx
ENV ASPNETCORE_Kestrel__Certificates__Default__Path=/app/certificate.pfx
ENV ASPNETCORE_ENVIRONMENT=Development
EXPOSE 5163 7163
ENTRYPOINT ["dotnet", "PasswordManagerAPI.dll"]