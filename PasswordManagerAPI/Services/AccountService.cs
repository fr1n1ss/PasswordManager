using Microsoft.AspNetCore.Mvc;
using RSAEncryptions;
using PasswordManagerAPI.Entities;
using Microsoft.EntityFrameworkCore;
using PasswordManagerAPI.Models;
using System.Security.Cryptography;
using System.Numerics;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore.Metadata.Internal;
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

            UpdateRSA(user, masterPassword);

            var encryptedPassword = _rsaEncryption.EncryptText(password);

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

            UpdateRSA(user, masterPassword);

            account.EncryptedPassword = _rsaEncryption.DecryptText(account.EncryptedPassword);

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

            UpdateRSA(user, masterPassword);

            foreach (var account in accounts)
            {
                account.EncryptedPassword = _rsaEncryption.DecryptText(account.EncryptedPassword);
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

            UpdateRSA(user, masterPassword);

            if (!string.IsNullOrEmpty(newLogin))
            {
                account.Login = newLogin;
                wasChanged = true;
            }

            if (!string.IsNullOrEmpty(newPassword))
            {
                account.EncryptedPassword = _rsaEncryption.EncryptText(newPassword);
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

            if(!string.IsNullOrEmpty(newUrl) && ValidURL(newUrl))
            {
                account.URL = newUrl;
                wasChanged = true;
            }

            if(wasChanged)
                account.CreationDate = DateTime.Now;

            _context.Accounts.Update(account);

            await _context.SaveChangesAsync();

        }
        private void UpdateRSA(User user, string masterPassword)
        {
            var privateKey = RsaKeyManager.DecryptPrivateKey(user.EncryptedPrivateKey, masterPassword, user.Salt);
            _rsaEncryption.OverrideKeys(BigInteger.Parse(user.PublicKey), privateKey, BigInteger.Parse(user.Modulus));
        }
        private bool ValidURL(string url)
        {
            return Uri.TryCreate(url, UriKind.Absolute, out Uri? uriResult)
                   && (uriResult.Scheme == Uri.UriSchemeHttp || uriResult.Scheme == Uri.UriSchemeHttps);
        }
    }
}
