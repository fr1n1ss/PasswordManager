namespace PasswordManagerAPI.Services
{
    public interface ITotpService
    {
        public (string base32, string uri) GenerateTotpSecret(string username);
        public bool Validate(string secret, string code);
    }
}
