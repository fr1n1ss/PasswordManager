using System.Web;

namespace Security.TOTP
{
    public static class OtpAuthHelper
    {
        public static string GenerateUri(string issuer, string accountName, string base32Secret)
        {
            string encodedIssuer = HttpUtility.UrlEncode(issuer);
            string encodedAccount = HttpUtility.UrlEncode(accountName);

            return $"otpauth://totp/{encodedIssuer}:{encodedAccount}?secret={base32Secret}&issuer={encodedIssuer}&digits=6&period=30";
        }
    }
}
