using PasswordManagerAPI.Entities;

namespace PasswordManagerAPI.Services
{
    public interface ITotpAccountService
    {
        public TotpAccount ParseOtpAuth(string uri);
        public string GenerateCode(TotpAccount account);
    }
}
