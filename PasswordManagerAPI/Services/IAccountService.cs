using PasswordManagerAPI.Entities;

namespace PasswordManagerAPI.Services
{
    public interface IAccountService
    {
        Account AddAccount(int userId, string login, string serviceName, string encryptedPassword, string url, string? description);
        Task<List<Account>> GetUserAccountsAsync(int userId);
        Task UpdateAccountAsync(int userId, int accountId, string? newLogin, string? newServiceName, string? newPassword, string? newUrl, string? newDescription);
        Task DeleteAccountAsync(int userId, int accountId);
    }
}
