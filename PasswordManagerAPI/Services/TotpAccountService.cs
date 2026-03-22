using PasswordManagerAPI.Entities;
using Security.TOTP;

namespace PasswordManagerAPI.Services
{
    public class TotpAccountService : ITotpAccountService
    {
        public TotpAccount ParseOtpAuth(string uri)
        {
            var parsed = new Uri(uri);
            var query = System.Web.HttpUtility.ParseQueryString(parsed.Query);

            return new TotpAccount
            {
                ServiceName = parsed.AbsolutePath.Trim('/'),
                Issuer = query["issuer"] ?? string.Empty,
                Secret = query["secret"] ?? string.Empty,
                Digits = int.TryParse(query["digits"], out var digits) ? digits : 6,
                Period = int.TryParse(query["period"], out var period) ? period : 30
            };
        }
        public string GenerateCode(TotpAccount account)
        {
            byte[] secret = Base32.Decode(account.Secret);
            var totp = new TotpGenerator(secret, account.Digits, account.Period);

            return totp.Generate();
        }
    }
}
