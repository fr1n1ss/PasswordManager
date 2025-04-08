# Используем образ для сборки
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /app

# Копируем файлы проекта и восстанавливаем зависимости
COPY *.csproj ./
RUN dotnet restore

# Копируем остальной код и собираем приложение
COPY . ./
RUN dotnet publish -c Release -o out

# Создаём финальный образ для запуска
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/out ./

# Указываем порт, который будет использовать приложение
EXPOSE 5163

# Запускаем приложение
ENTRYPOINT ["dotnet", "PasswordManager.dll"]