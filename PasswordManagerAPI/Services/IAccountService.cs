using Microsoft.AspNetCore.Mvc;
using PasswordManagerAPI.Entities;
using static PasswordManagerAPI.Services.AccountService;

namespace PasswordManagerAPI.Services
{
    public interface IAccountService
    {
        Account AddAccount(int userId, string login, string serviceName, string encryptedPassword, string url, string? description);
        Task<List<Account>> GetUserAccountsAsync(int userId);
        Task<Account> GetAccountByIdAsync(int userId, int accountId);
        Task UpdateAccountAsync(int userId, int accountId, string? newLogin, string? newServiceName, string? newPassword, string? newUrl, string? newDescription);
        Task<string> GetHashAsync(int userId);
        Task DeleteAccountAsync(int userId, int accountId);
    }
}
