using Microsoft.AspNetCore.Mvc;
using PasswordManagerAPI.Entities;
using Microsoft.EntityFrameworkCore;
using PasswordManagerAPI.Models;
using System.Security.Cryptography;
using System.Numerics;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore.Metadata.Internal;
using Newtonsoft.Json;
using System.Text;
using Security.RSA;
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

        public Account AddAccount(int userId, string login, string serviceName, string password, string url, string? description, string masterPassword)
        {
            var user = _context.Users.AsNoTracking().FirstOrDefault(u => u.Id == userId);
            if (user == null)
                throw new ArgumentException("User with this userId not found");
                
            var existingAccount = _context.Accounts.AsNoTracking().FirstOrDefault(a => a.UserID == userId && a.Login == login && a.ServiceName == serviceName);
            if (existingAccount != null)
                throw new ArgumentException("Account with these parameters already exists");

            if (!ValidURL(url))
                throw new ArgumentException("URL is invalid");

            var encryptedPassword = KuznyechikStorageProtection.Encrypt(password, masterPassword, user.Salt);

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

        public async Task<Account> GetAccountByIdAsync(int userId, int accountId, string masterPassword)
        {
            var account = await _context.Accounts.FirstOrDefaultAsync(a => a.ID == accountId && a.UserID == userId);

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);

            if (account == null)
                throw new ArgumentNullException("Account with this ID not found");

            if(user == null)
                throw new ArgumentNullException("User with this ID not found");

            account.EncryptedPassword = DecryptPassword(account.EncryptedPassword, user, masterPassword);

            return account;
        }

        public async Task<List<Account>> GetUserAccountsAsync(int userId, string masterPassword)
        {
            var accounts = await _context.Accounts.Where(u => u.UserID == userId).ToListAsync();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);

            if(accounts.Count == 0)
                return new List<Account>();
            if(user == null)
                throw new ArgumentNullException("User with this ID not found");

            foreach (var account in accounts)
            {
                account.EncryptedPassword = DecryptPassword(account.EncryptedPassword, user, masterPassword);
            }

            return accounts;
        }

        public async Task UpdateAccountAsync(int userId, int accountId, string? newLogin, string? newServiceName, string? newPassword, string? newUrl, string? newDescription, string masterPassword)
        {
            var wasChanged = false;

            var account = await _context.Accounts.FirstOrDefaultAsync(a => a.ID == accountId && a.UserID == userId);

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);

            if (account == null)
                throw new ArgumentNullException("Account with this ID not found");
            if (user == null)
                throw new ArgumentNullException("User with this ID not found");

            if (!string.IsNullOrEmpty(newLogin))
            {
                account.Login = newLogin;
                wasChanged = true;
            }

            if (!string.IsNullOrEmpty(newPassword))
            {
                account.EncryptedPassword = KuznyechikStorageProtection.Encrypt(newPassword, masterPassword, user.Salt);
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
        private void UpdateRSA(User user, string masterPassword)
        {
            var privateKey = RsaKeyManager.DecryptPrivateKey(user.EncryptedPrivateKey, masterPassword, user.Salt);
            _rsaEncryption.OverrideKeys(BigInteger.Parse(user.PublicKey), privateKey, BigInteger.Parse(user.Modulus));
        }

        private string DecryptPassword(string encryptedPassword, User user, string masterPassword)
        {
            if (KuznyechikStorageProtection.IsProtectedPayload(encryptedPassword))
            {
                return KuznyechikStorageProtection.Decrypt(encryptedPassword, masterPassword, user.Salt);
            }

            UpdateRSA(user, masterPassword);
            return _rsaEncryption.DecryptText(encryptedPassword);
        }
        private bool ValidURL(string url)
        {
            return Uri.TryCreate(url, UriKind.Absolute, out Uri? uriResult)
                   && (uriResult.Scheme == Uri.UriSchemeHttp || uriResult.Scheme == Uri.UriSchemeHttps);
        }
    }
}
