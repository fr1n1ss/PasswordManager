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

        public async Task<Account> AddAccountAsync(int userID, string login, string serviceName, string password, string? description)
        {
            var user = await _context.Users.FindAsync(userID);

            var account = await _context.Accounts.FirstOrDefaultAsync(a => a.UserID == userID && a.Login == login && a.ServiceName == serviceName);

            if (user == null)
                throw new ArgumentNullException("User with this userID not exist");

            if(account != null)
                throw new ArgumentException("Account with these parameters already exists");

            var encryptedPassword = _rsaEncryption.EncryptText(password);

            account = new Account
            {
                UserID = userID,
                Login = login,
                EncryptedPassword = encryptedPassword,
                ServiceName = serviceName,
                Description = description,
                Salt = GenerateSalt(),
                CreationDate = DateTime.Now
            };

            _context.Accounts.Add(account);

            await _context.SaveChangesAsync();

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

        public async Task<List<Account>> GetUserPasswordsAsync(int userId)
        {
            var passwords = await _context.Accounts.Where(u => u.UserID == userId).ToListAsync();

            foreach(var account in passwords)
            {
                account.EncryptedPassword = _rsaEncryption.DecryptText(account.EncryptedPassword);
            }

            return passwords;
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
