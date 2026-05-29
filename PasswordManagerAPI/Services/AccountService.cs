using PasswordManagerAPI.Entities;
using Microsoft.EntityFrameworkCore;
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
                throw new ArgumentException("Пользователь не найден");
                
            var existingAccount = _context.Accounts.AsNoTracking().FirstOrDefault(a => a.UserID == userId && a.Login == login && a.ServiceName == serviceName);
            if (existingAccount != null)
                throw new ArgumentException("Аккаунт с такими параметрами уже существует");

            if (!ValidURL(url))
                throw new ArgumentException("Некорректный URL");

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
                throw new ArgumentNullException("Аккаунт не найден");

            var favorite = await _context.Favorites.FirstOrDefaultAsync(f => f.UserId == userId && f.EntityType == "account" && f.EntityId == account.ID);
            if (favorite != null)
                _context.Favorites.Remove(favorite);

            _context.Accounts.Remove(account);

            await _context.SaveChangesAsync();
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
                throw new ArgumentNullException("Аккаунт не найден");

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
        private bool ValidURL(string url)
        {
            return Uri.TryCreate(url, UriKind.Absolute, out Uri? uriResult)
                   && (uriResult.Scheme == Uri.UriSchemeHttp || uriResult.Scheme == Uri.UriSchemeHttps);
        }
    }
}
