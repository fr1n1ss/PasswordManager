using Microsoft.AspNetCore.Mvc;
using PasswordManagerAPI.Entities;
using Microsoft.EntityFrameworkCore;
using PasswordManagerAPI.Models;
using System.Security.Cryptography;
using Newtonsoft.Json;
using System.Text;
namespace PasswordManagerAPI.Services
{
    public class AccountService : IAccountService
    {
        private readonly AppDbContext _context;

        public AccountService(AppDbContext context)
        {
            _context = context;
        }

        public Account AddAccount(int userId, string login, string serviceName, string encryptedPassword, string url, string? description)
        {
            var user = _context.Users.AsNoTracking().FirstOrDefault(u => u.Id == userId);
            if (user == null)
                throw new ArgumentException("User with this userId not found");
                
            var existingAccount = _context.Accounts.AsNoTracking().FirstOrDefault(a => a.UserID == userId && a.Login == login && a.ServiceName == serviceName);
            if (existingAccount != null)
                throw new ArgumentException("Account with these parameters already exists");

            if (!ValidURL(url))
                throw new ArgumentException("URL is invalid");

            var account = new Account
            {
                UserID = userId,
                Login = login,
                EncryptedPassword = encryptedPassword,
                ServiceName = serviceName,
                Description = description,
                URL = url,
                CreationDate = DateTime.UtcNow
            };

            _context.Accounts.Add(account);
            _context.SaveChanges();

            return account;
        }

        public async Task DeleteAccountAsync(int userId, int accountId)
        {
            var account = await _context.Accounts.FirstOrDefaultAsync(a => a.ID == accountId && a.UserID == userId);

            if(account == null)
                throw new ArgumentNullException("Account with this ID not found");

            var favorite = await _context.Favorites.FirstOrDefaultAsync(f => f.UserId == userId && f.EntityType == "account" && f.EntityId == account.ID);
            if (favorite != null)
                _context.Favorites.Remove(favorite);

            _context.Accounts.Remove(account);

            await _context.SaveChangesAsync();
        }

        public async Task<Account> GetAccountByIdAsync(int userId, int accountId)
        {
            var account = await _context.Accounts.FirstOrDefaultAsync(a => a.ID == accountId && a.UserID == userId);

            if (account == null)
                throw new ArgumentNullException("Account with this ID not found");

            return account;
        }

        public async Task<List<Account>> GetUserAccountsAsync(int userId)
        {
            var accounts = await _context.Accounts.Where(u => u.UserID == userId).ToListAsync();

            if (accounts.Count == 0)
                return new List<Account>();

            return accounts;
        }

        public async Task UpdateAccountAsync(int userId, int accountId, string? newLogin, string? newServiceName, string? newPassword, string? newUrl, string? newDescription)
        {
            var wasChanged = false;

            var account = await _context.Accounts.FirstOrDefaultAsync(a => a.ID == accountId && a.UserID == userId);

            if (account == null)
                throw new ArgumentNullException("Account with this ID not found");

            if (!string.IsNullOrEmpty(newLogin))
            {
                account.Login = newLogin;
                wasChanged = true;
            }

            if (!string.IsNullOrEmpty(newPassword))
            {
                account.EncryptedPassword = newPassword;
                wasChanged = true;
            }

            if (!string.IsNullOrEmpty(newServiceName))
            {
                account.ServiceName = newServiceName;
                wasChanged = true;
            }

            if (!string.IsNullOrEmpty(newDescription))
            {
                account.Description = newDescription;
                wasChanged = true;
            }

            if (!string.IsNullOrEmpty(newUrl) && ValidURL(newUrl))
            {
                account.URL = newUrl;
                wasChanged = true;
            }

            if (wasChanged)
                account.CreationDate = DateTime.Now;

            _context.Accounts.Update(account);

            await _context.SaveChangesAsync();

        }
        public async Task<string> GetHashAsync(int userId)
        {
            var notes = await _context.Accounts.Where(n => n.UserID == userId).ToListAsync();

            string accountsJson = JsonConvert.SerializeObject(notes);

            using var sha256 = SHA256.Create();
            var accountsHash = Convert.ToHexString(sha256.ComputeHash(Encoding.UTF8.GetBytes(accountsJson)));

            return accountsHash = accountsHash.ToLower();
        }

        private bool ValidURL(string url)
        {
            return Uri.TryCreate(url, UriKind.Absolute, out Uri? uriResult)
                   && (uriResult.Scheme == Uri.UriSchemeHttp || uriResult.Scheme == Uri.UriSchemeHttps);
        }
    }
}
