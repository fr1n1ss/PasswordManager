using Security.RSA;
using Security.TOTP;
using System.Security.Cryptography;

namespace PasswordManagerAPI.Services
{
    public class TotpService : ITotpService
    {
        private RSAEncryption _rsaEncryption;
        private AppDbContext _context;
        public TotpService(RSAEncryption rsaEncryption, AppDbContext context)
        {
            _rsaEncryption = rsaEncryption;
            _context = context;
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

        public bool Validate(string secret, string code)
        {
            var totp = new TotpGenerator(Base32.Decode(secret));
            return totp.Validate(code);
        }
    }
}
