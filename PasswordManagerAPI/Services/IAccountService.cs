﻿using PasswordManagerAPI.Entities;
using static PasswordManagerAPI.Services.AccountService;

namespace PasswordManagerAPI.Services
{
    public interface IAccountService
    {
        Account AddAccount(int userId, string login, string serviceName, string password, string? description, string masterPassword);
        Task<List<Account>> GetUserAccountsAsync(int userId, string masterPassword);
        Task<Account> GetAccountByIdAsync(int userId, int accountId, string masterPassword);
        Task UpdateAccountAsync(int userId, int accountId, string? newLogin, string? newServiceName, string? newPassword, string masterPassword);
        Task DeleteAccountAsync(int userId, int accountId);
    }
}
