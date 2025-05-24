
# 🔐 PasswordManager

**PasswordManager** — это кроссплатформенное приложение для безопасного хранения паролей и заметок с применением криптографических методов защиты. Проект реализован в рамках курсовой работы и демонстрирует использование симметричного и асимметричного шифрования, а также безопасной аутентификации.

## 📌 Основные технологии

- **Backend:** ASP.NET Core (.NET 8), MS SQL Server, JWT, AES, кастомная реализация RSA
- **Frontend:** Tauri, Vite, TypeScript, HTML, CSS
- **Шифрование:**
  - RSA — шифрование паролей и заметок (реализация вручную)
  - AES — шифрование приватного ключа RSA (на основе мастер-пароля)
  - SHA-256 — хэширование паролей пользователей
  - JWT — авторизация и аутентификация

---

## 🛠 Установка и запуск проекта

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

## ✅ Как пользоваться

1. Зарегистрируйтесь и авторизуйтесь.
2. Введите **мастер-пароль**, который будет использоваться для шифрования приватного ключа.
3. Добавляйте пароли и заметки — они будут зашифрованы алгоритмом RSA.
4. Используйте избранное, модальные окна и сортировку для удобства.
5. Все чувствительные данные хранятся в базе в зашифрованном виде.

---

## 🧪 Тестирование

В проекте реализовано юнит-тестирование кастомной реализации RSA. Для запуска тестов используйте:

```bash
cd PasswordManagerTests
dotnet test
```

---

## 📎 Ссылка на репозиторий

[https://github.com/fr1n1ss/PasswordManager](https://github.com/fr1n1ss/PasswordManager)
