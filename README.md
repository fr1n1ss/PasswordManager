
# PasswordManager

**PasswordManager** — это кроссплатформенное приложение для безопасного хранения паролей и заметок с применением криптографических методов защиты. Проект реализован в рамках курсовой работы и демонстрирует использование симметричного и асимметричного шифрования, а также безопасной аутентификации.

## Основные технологии

- **Backend:** ASP.NET Core (.NET 8), MS SQL Server, JWT, AES, кастомная реализация RSA
- **Frontend:** Tauri, Vite, TypeScript, HTML, CSS
- **Шифрование:**
  - RSA — шифрование паролей и заметок (реализация вручную)
  - AES — шифрование приватного ключа RSA (на основе мастер-пароля)
  - SHA-256 — хэширование паролей пользователей
  - JWT — авторизация и аутентификация

---

## Установка и запуск проекта

### 1. Клонирование репозитория

```bash
git clone https://github.com/fr1n1ss/PasswordManager.git
cd PasswordManager
```

---

### 2. Настройка серверной части (ASP.NET Core API)

#### Требования:
- [.NET 8 SDK](https://dotnet.microsoft.com/en-us/download)
- [MS SQL Server](https://www.microsoft.com/en-us/sql-server/sql-server-downloads)

#### Шаги:

1. Перейдите в папку `PasswordManagerAPI`:

```bash
cd PasswordManagerAPI
```

2. Настройте строку подключения к базе данных в `appsettings.json`:

```json
"ConnectionStrings": {
  "DefaultConnection": "Server=localhost;Database=PasswordManagerDb;Trusted_Connection=True;"
}
```

3. Примените миграции (если не применены):

```bash
dotnet ef database update
```

4. Запустите сервер:

```bash
dotnet run
```

Сервер по умолчанию запускается на `https://localhost:7163`.

---

### 3. Настройка клиентской части (Tauri + Vite + TypeScript)

#### Требования:
- [Node.js](https://nodejs.org/)
- [Rust](https://www.rust-lang.org/tools/install)
- [Tauri CLI](https://tauri.app/v1/guides/getting-started/prerequisites/)

#### Шаги:

1. Перейдите в директорию с клиентом:

```bash
cd ../password-manager-ui
```

2. Установите зависимости:

```bash
npm install
```

3. Запустите клиентское приложение:

```bash
npm run tauri dev
```

---

## Настройка HTTPS-сертификата

Приложение использует **HTTPS** для безопасной связи между клиентом и сервером. Для локального запуска необходимо создать самоподписанный сертификат с поддержкой SAN (Subject Alternative Name).

### Установка OpenSSL (если не установлен)

1. Перейдите на сайт: https://slproweb.com/products/Win32OpenSSL.html
2. Скачайте **Win64 OpenSSL Light**
3. Установите с параметрами по умолчанию
4. В PowerShell проверьте:
```powershell
openssl version
```
Если команда не найдена, добавьте путь к OpenSSL (например, `C:\Program Files\OpenSSL-Win64\bin`) в переменную среды `Path`.

### Создание сертификата

1. Перейдите в `PasswordManagerAPI`:

```bash
cd PasswordManagerAPI
```

2. Создайте файл `cert.conf` со следующим содержимым:

```
[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_req
prompt = no

[req_distinguished_name]
CN = 192.168.0.101

[v3_req]
subjectAltName = IP:192.168.0.101
```

Замените `192.168.0.101` на ваш IP или `localhost`.

3. Выполните команды:

```bash
openssl req -x509 -newkey rsa:2048 -keyout localhost.key -out localhost.crt -days 365 -nodes -config cert.conf
openssl pkcs12 -export -out localhost.pfx -inkey localhost.key -in localhost.crt -passout pass:yourpassword
```

4. Установите сертификат (Windows):
- Дважды щёлкните по `localhost.crt`
- Нажмите "Установить сертификат" → "Локальный компьютер" → "Доверенные корневые центры сертификации"
- Перезагрузите компьютер

5. В `appsettings.json` укажите путь к `localhost.pfx` и используемый пароль


---

## Как пользоваться

1. Зарегистрируйтесь и авторизуйтесь.
2. Введите **мастер-пароль**, который будет использоваться для шифрования приватного ключа.
3. Добавляйте пароли и заметки — они будут зашифрованы алгоритмом RSA.
4. Используйте избранное, модальные окна и сортировку для удобства.
5. Все чувствительные данные хранятся в базе в зашифрованном виде.

---

## Тестирование

В проекте реализовано юнит-тестирование кастомной реализации RSA. Для запуска тестов используйте:

```bash
cd PasswordManagerTests
dotnet test
```

---

## Ссылка на репозиторий

[https://github.com/fr1n1ss/PasswordManager](https://github.com/fr1n1ss/PasswordManager)
