# PasswordManager

**PasswordManager** - веб-приложение для безопасного хранения учетных записей, паролей, заметок и TOTP-аккаунтов.

Проект разработан в рамках выпускной квалификационной работы и демонстрирует работу с защищенной аутентификацией, JWT-сессиями, мастер-паролем, двухфакторной аутентификацией, клиентским шифрованием пользовательских данных, избранным и аудитом действий.

Приложение состоит из ASP.NET Core API, frontend на Vite + TypeScript, SQL Server и Docker-инфраструктуры с Nginx и Caddy.

## Основные возможности

- регистрация и авторизация пользователей;
- подтверждение email через SMTP;
- JWT-аутентификация с проверкой активных сессий;
- управление активными сессиями пользователя;
- хранение зашифрованных учетных записей;
- хранение зашифрованных заметок;
- работа с избранным;
- хранение TOTP-аккаунтов и генерация одноразовых кодов;
- импорт TOTP из OTPAuth URI и QR-кода;
- генератор паролей;
- смена пароля аккаунта;
- смена и ротация мастер-пароля;
- двухфакторная аутентификация;
- аудит пользовательских действий;
- Swagger UI для API в режиме разработки.

## Технологии

- **Backend:** ASP.NET Core 8, Entity Framework Core, SQL Server, JWT, Swagger
- **Frontend:** Vite, TypeScript, HTML, CSS, Axios
- **Криптография:** клиентское zero-knowledge шифрование, алгоритм "Кузнечик", TOTP
- **Инфраструктура:** Docker Compose, SQL Server 2022, Nginx, Caddy

Реализация алгоритма "Кузнечик" на C# вынесена в отдельный репозиторий: [fr1n1ss/Kuznyechik](https://github.com/fr1n1ss/Kuznyechik).

## Структура проекта

```text
PasswordManager/
|-- PasswordManagerAPI/      # ASP.NET Core API
|-- password-manager-ui/     # frontend на Vite + TypeScript
|-- Security/                # криптографическая библиотека
|-- docker-compose.yml       # основной Docker Compose
|-- docker-compose.local.yml # локальный override для проброса SQL Server
|-- Dockerfile               # Dockerfile для API
|-- Caddyfile                # reverse proxy
`-- .env.example             # пример переменных окружения
```

## Запуск через Docker

### 1. Клонирование репозитория

```bash
git clone https://github.com/fr1n1ss/PasswordManager.git
cd PasswordManager
```

### 2. Создание `.env`

Скопируйте пример переменных окружения:

```bash
cp .env.example .env
```

Для Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

### 3. Настройка `.env`

Заполните значения в файле `.env`:

```env
APP_HOST=http://localhost

SA_PASSWORD=ChangeMe_StrongPassword_123!
JWT_KEY=ChangeMe_Long_Jwt_Key_At_Least_32_Chars

SMTP_HOST=smtp.mail.ru
SMTP_PORT=587
SMTP_FROM=your_email@example.com
SMTP_USERNAME=your_email@example.com
SMTP_PASSWORD=your_smtp_app_password
SMTP_ENABLE_SSL=true
```

Описание переменных:

- `APP_HOST` - адрес, на котором Caddy будет принимать запросы. Для локального запуска используйте `http://localhost`.
- `SA_PASSWORD` - пароль администратора SQL Server. Пароль должен быть сложным.
- `JWT_KEY` - секретный ключ для подписи JWT. Используйте длинную строку, минимум 32 символа.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_ENABLE_SSL` - настройки SMTP для отправки писем подтверждения email и восстановления доступа.

### 4. Запуск приложения

Запустите все сервисы:

```bash
docker compose up --build -d
```

После запуска приложение будет доступно по адресу:

```text
http://localhost
```

Docker Compose поднимает следующие контейнеры:

- `passwordmanager-database` - SQL Server;
- `passwordmanager-api` - ASP.NET Core API;
- `passwordmanager-frontend` - собранный frontend через Nginx;
- `passwordmanager-caddy` - reverse proxy для доступа к приложению.

Frontend отправляет запросы на `/api`, Nginx проксирует их в контейнер API на порт `8080`.

## Локальный запуск без Docker

### Backend

Перейдите в папку backend-проекта:

```bash
cd PasswordManagerAPI
```

В текущем `appsettings.json` значения секретов пустые, поэтому для локального запуска нужно указать настройки через `appsettings.json`, пользовательские секреты или переменные окружения.

Пример настроек:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost,14330;Database=PasswordManagerDb;User Id=sa;Password=YOUR_SA_PASSWORD;TrustServerCertificate=True;"
  },
  "Jwt": {
    "Key": "ChangeMe_Long_Jwt_Key_At_Least_32_Chars",
    "Issuer": "passwordmanager",
    "Audience": "passwordmanager_users"
  },
  "Smtp": {
    "Host": "smtp.mail.ru",
    "Port": "587",
    "From": "your_email@example.com",
    "Username": "your_email@example.com",
    "Password": "your_smtp_app_password",
    "EnableSsl": "true"
  }
}
```

Примените миграции:

```bash
dotnet ef database update
```

Запустите API:

```bash
dotnet run
```

API слушает порт `8080`.

Swagger UI доступен только в режиме разработки:

```text
http://localhost:8080/swagger
```

### Frontend

Перейдите в папку frontend:

```bash
cd password-manager-ui
```

Установите зависимости:

```bash
npm install
```

Запустите dev-сервер:

```bash
npm run dev
```

Frontend запускается на:

```text
http://localhost:3000
```

Vite проксирует запросы `/api` на backend. Если API запущен на другом адресе, измените `target` в файле:

```text
password-manager-ui/vite.config.ts
```

## Ссылка на репозиторий

[https://github.com/fr1n1ss/PasswordManager](https://github.com/fr1n1ss/PasswordManager)
