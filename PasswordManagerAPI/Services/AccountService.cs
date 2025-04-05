using Microsoft.AspNetCore.Mvc;
using RSAEncryptions;
using PasswordManagerAPI.Entities;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Numerics;
namespace PasswordManagerAPI.Services
{
    public class AccountService : IAccountService
    {
        private readonly AppDbContext _context;
        private RSAEncryption _rsaEncryption;

        public AccountService(AppDbContext context, RSAEncryption rsaEncryption)
        {
            _context = context;
            _rsaEncryption = rsaEncryption;
        }

        public Account AddAccount(int userId, string login, string serviceName, string password, string? description, string masterPassword)
        {
            var user = _context.Users.AsNoTracking().FirstOrDefault(u => u.Id == userId);
            if (user == null)
                throw new ArgumentException("User with this userId not found");
                
            var existingAccount = _context.Accounts.AsNoTracking().FirstOrDefault(a => a.UserID == userId && a.Login == login && a.ServiceName == serviceName);
            if (existingAccount != null)
                throw new ArgumentException("Account with these parameters already exists");

            var privateKey = RsaKeyManager.DecryptPrivateKey(user.EncryptedPrivateKey, masterPassword, user.Salt);
            _rsaEncryption.OverrideKeys(BigInteger.Parse(user.PublicKey), privateKey, BigInteger.Parse(user.Modulus));

            var encryptedPassword = _rsaEncryption.EncryptText(password);

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

        public async Task<Account> GetAccountByIdAsync(int userId, int accountId)
        {
            var account = await _context.Accounts.FirstOrDefaultAsync(a => a.ID == accountId && a.UserID == userId);
            if (account == null)
                throw new ArgumentNullException("Account with this ID not found");

            account.EncryptedPassword = _rsaEncryption.DecryptText(account.EncryptedPassword);

            return account;
        }

        public async Task<List<Account>> GetUserAccountsAsync(int userId, string masterPassword)
        {
            var accounts = await _context.Accounts.Where(u => u.UserID == userId).ToListAsync();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);

            if(accounts == null)
                throw new ArgumentNullException("Account with this ID not found");
            if(user == null)
                throw new ArgumentNullException("User with this ID not found");

            var privateKey = RsaKeyManager.DecryptPrivateKey(user.EncryptedPrivateKey, masterPassword, user.Salt);
            _rsaEncryption.OverrideKeys(BigInteger.Parse(user.PublicKey), privateKey, BigInteger.Parse(user.Modulus));

            foreach (var account in accounts)
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
