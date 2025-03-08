using PasswordManagerAPI.Entities;

namespace PasswordManagerAPI.Services
{
    public interface IAccountService
    {
        Task<Account> AddPasswordAsync(int userId, string serviceName, string password);
        Task<List<Account>> GetUserPasswordsAsync(int userId);
        Task<Account> GetAccountByIdAsync(int userId, int accountId);
        Task UpdateAccountAsync(int userId, int passwordId, string newServiceName, string newPassword);
        Task DeleteAccountAsync(int userId, int passwordId);
    }
}
