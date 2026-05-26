# PasswordManager

**PasswordManager** - приложение для безопасного хранения учетных записей, паролей, заметок и TOTP-аккаунтов. Проект состоит из ASP.NET Core API, frontend на Vite + TypeScript, SQL Server и отдельных криптографических библиотек с реализациями RSA и алгоритма "Кузнечик".

Проект разработан в рамках выпускной квалификационной работы и демонстрирует работу с защищенной аутентификацией, JWT-сессиями, шифрованием пользовательских данных, мастер-паролем, двухфакторными кодами, избранным и аудитом действий.

## Основные возможности

- регистрация и авторизация пользователей;
- хранение зашифрованных учетных записей и заметок;
- работа с избранным;
- хранение и генерация TOTP-кодов;
- генератор паролей;
- смена и ротация мастер-пароля;
- подтверждение email через SMTP;
- аудит пользовательских действий;
- JWT-аутентификация с проверкой активных сессий;
- Swagger UI для API в режиме разработки.

## Технологии

- **Backend:** ASP.NET Core (.NET 8), Entity Framework Core, SQL Server, JWT, Swagger
- **Frontend:** Vite, TypeScript, HTML, CSS, Axios
- **Криптография:** "Кузнечик", SHA-256, TOTP
- **Инфраструктура:** Docker Compose для SQL Server

Реализация алгоритма "Кузнечик" на C# вынесена в отдельный репозиторий: [fr1n1ss/Kuznyechik](https://github.com/fr1n1ss/Kuznyechik).

## Установка и запуск

### 1. Клонирование репозитория

```bash
git clone https://github.com/fr1n1ss/PasswordManager.git
cd PasswordManager
```

### 2. Запуск SQL Server

В корне проекта создайте или заполните файл `.env`:

```env
SA_PASSWORD=Your_strong_password123
```

Запустите контейнер с базой данных:

```bash
docker compose up -d
```

SQL Server будет доступен на порту `1433`.

### 3. Настройка API

Перейдите в папку backend-проекта:

```bash
cd PasswordManagerAPI
```

Заполните `appsettings.json` или пользовательские секреты:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost,1433;Database=PasswordManagerDb;User Id=sa;Password=Your_strong_password123;TrustServerCertificate=True;"
  },
  "Jwt": {
    "Key": "your-long-secret-key",
    "Issuer": "passwordmanager",
    "Audience": "passwordmanager_users"
  },
  "Smtp": {
    "Host": "smtp.example.com",
    "Port": "587",
    "From": "noreply@example.com",
    "Username": "smtp-user",
    "Password": "smtp-password",
    "EnableSsl": "true"
  },
  "Kestrel": {
    "Endpoints": {
      "Https": {
        "Url": "https://0.0.0.0:7163",
        "Certificate": {
          "Path": "../certificate.pfx",
          "Password": "certificate-password"
        }
      }
    }
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

По умолчанию API используется на `https://localhost:7163`. Swagger доступен в режиме разработки по адресу:

```text
https://localhost:7163/swagger
```

### 4. Настройка frontend

Откройте папку клиента:

```bash
cd ../password-manager-ui
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

Vite проксирует запросы `/api` на backend. Если API запущен на другом адресе, измените `target` в `password-manager-ui/vite.config.ts`.

## HTTPS-сертификат для локального запуска

Backend настроен на HTTPS через Kestrel. Для локального запуска нужен `.pfx`-сертификат и пароль к нему.

Пример создания сертификата через OpenSSL:

```bash
openssl req -x509 -newkey rsa:2048 -keyout localhost.key -out localhost.crt -days 365 -nodes -subj "/CN=localhost"
openssl pkcs12 -export -out localhost.pfx -inkey localhost.key -in localhost.crt -passout pass:certificate-password
```

После создания укажите путь к `.pfx` и пароль в настройках `Kestrel:Endpoints:Https:Certificate`.

## Сборка

Сборка backend:

```bash
dotnet build PasswordManager.sln
```

Сборка frontend:

```bash
cd password-manager-ui
npm run build
```

## Ссылка на репозиторий

[https://github.com/fr1n1ss/PasswordManager](https://github.com/fr1n1ss/PasswordManager)