using Microsoft.AspNetCore.Mvc;
using RSAEncryptions;
using PasswordManagerAPI.Entities;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
namespace PasswordManagerAPI.Services
{
    public class AccountService : IAccountService
    {
        private readonly AppDbContext _context;
        private readonly RSAEncryption _rsaEncryption;

        public AccountService(AppDbContext context, RSAEncryption rsaEncryption)
        {
            _context = context;
            _rsaEncryption = rsaEncryption;
        }

        public Account AddAccount(int userId, string login, string serviceName, string password, string? description)
        {
            // Проверка пользователя (синхронно)
            var user = _context.Users
                .AsNoTracking()
                .FirstOrDefault(u => u.Id == userId);
            if (user == null)
                throw new ArgumentException("User with this userId not found, братишка! 😭");
                
            // Проверка на дубликат аккаунта (синхронно)
            var existingAccount = _context.Accounts
                .AsNoTracking()
                .FirstOrDefault(a => a.UserID == userId && a.Login == login && a.ServiceName == serviceName);
            if (existingAccount != null)
                throw new ArgumentException("Account with these parameters already exists, чел! 🤔");

            // Шифруем пароль
            var encryptedPassword = _rsaEncryption.EncryptText(password);

            // Создаём новый аккаунт
            var account = new Account
            {
                UserID = userId,
                Login = login,
                EncryptedPassword = encryptedPassword,
                ServiceName = serviceName,
                Description = description,
                Salt = GenerateSalt(),
                CreationDate = DateTime.UtcNow
            };

            // Добавляем и сохраняем (синхронно)
            _context.Accounts.Add(account);
            _context.SaveChanges();

            return account;
        }

        public async Task DeleteAccountAsync(int userId, int accountId)
        {
            var account = await _context.Accounts.FirstOrDefaultAsync(a => a.ID == accountId && a.UserID == userId);

            if(account == null)
                throw new ArgumentNullException("Account with this ID not found");

            _context.Accounts.Remove(account);

            await _context.SaveChangesAsync();
        }

        public async Task<List<Account>> GetAccountsAsync(int userID)
        {
            return await _context.Accounts.Where(u => u.UserID == userID).ToListAsync();
        }

        public async Task<Account> GetAccountByIdAsync(int userId, int accountId)
        {
            var account = await _context.Accounts.FirstOrDefaultAsync(a => a.ID == accountId && a.UserID == userId);
            if (account == null)
                throw new ArgumentNullException("Account with this ID not found");

            account.EncryptedPassword = _rsaEncryption.DecryptText(account.EncryptedPassword);

            return account;
        }

        public async Task<List<Account>> GetUserAccountsAsync(int userId)
        {
            var accounts = await _context.Accounts.Where(u => u.UserID == userId).ToListAsync();

            foreach(var account in accounts)
            {
                account.EncryptedPassword = _rsaEncryption.DecryptText(account.EncryptedPassword);
            }

            return accounts;
        }

        public async Task UpdateAccountAsync(int userId, int accountId, string? newServiceName, string newPassword)
        {
            var account = await _context.Accounts.FirstOrDefaultAsync(a => a.ID == accountId && a.UserID == userId);

            if (account == null)
                throw new ArgumentNullException("Account with this ID not found");

            if (!string.IsNullOrEmpty(newPassword))
            {
                account.EncryptedPassword = _rsaEncryption.EncryptText(newPassword);
            }

            if (!string.IsNullOrEmpty(newServiceName))
            {
                account.ServiceName = newServiceName;
            }

            if(!string.IsNullOrEmpty(newPassword) || !string.IsNullOrEmpty(newServiceName))
                account.CreationDate = DateTime.Now;

            _context.Accounts.Update(account);

            await _context.SaveChangesAsync();


        }

        private string GenerateSalt()
        {
            byte[] saltBytes = new byte[16];
            using (var rng = RandomNumberGenerator.Create())
            {
                rng.GetBytes(saltBytes);
            }
            return Convert.ToBase64String(saltBytes);
        }
    }
}
