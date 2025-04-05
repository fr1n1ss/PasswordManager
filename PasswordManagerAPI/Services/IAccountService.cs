using PasswordManagerAPI.Entities;
using static PasswordManagerAPI.Services.AccountService;

namespace PasswordManagerAPI.Services
{
    public interface IAccountService
    {
        Account AddAccount(int userId, string login, string serviceName, string password, string? description, string masterPassword);
        Task<List<Account>> GetUserAccountsAsync(int userId, string masterPassword);
        Task<Account> GetAccountByIdAsync(int userId, int accountId);
        Task UpdateAccountAsync(int userId, int accountId, string? newServiceName, string newPassword);
        Task DeleteAccountAsync(int userId, int accountId);
    }
}
