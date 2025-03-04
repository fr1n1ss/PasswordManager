using Microsoft.AspNetCore.Mvc;
using RSAEncryptions;
using PasswordManagerAPI.Entities;
using Microsoft.EntityFrameworkCore;
namespace PasswordManagerAPI.Services
{
    public class AccountService
    {
        private readonly AppDbContext _context;
        private readonly RSAEncryption _rsaEncryption;

        public AccountService(AppDbContext context, RSAEncryption rsaEncryption)
        {
            _context = context;
            _rsaEncryption = rsaEncryption;
        }

        public async Task<List<Account>> GetAccountsAsync(int userID)
        {
            return await _context.Accounts.Where(u => u.UserID == userID).ToListAsync();
        }
    }
}
