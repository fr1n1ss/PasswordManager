using Security.TOTP;
using System.Security.Cryptography;

namespace PasswordManagerAPI.Services
{
    public class TotpService : ITotpService
    {
        private readonly SecurityHelper _secretProtector;
        public TotpService(SecurityHelper helper)
        {
            _secretProtector = helper;
        }
        public (string base32, string uri) GenerateTotpSecret(string username)
        {
            byte[] secret = new byte[20];
            RandomNumberGenerator.Fill(secret);

            string base32 = Base32.Encode(secret);

            string uri = OtpAuthHelper.GenerateUri(
                issuer: "PasswordManager",
                accountName: username,
                base32Secret: base32
            );

            return (base32, uri);
        }

        public string Protect(string plainSecret) => _secretProtector.Protect(plainSecret);

        public bool Validate(string storagedSecret, string code)
        {
            var secret = _secretProtector.Unprotect(storagedSecret);
            var totp = new TotpGenerator(Base32.Decode(secret));
            return totp.Validate(code);
        }


    }
}
