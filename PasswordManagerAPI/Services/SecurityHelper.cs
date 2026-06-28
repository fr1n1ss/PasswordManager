using PasswordManagerAPI.Entities;
using KuznyechikLib;
using KuznyechikLib.CipherMode;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace PasswordManagerAPI.Services
{

    public class SecurityHelper
    {
        private readonly IConfiguration _config;
        private readonly JwtKeyProvider _jwtKeyProvider;

        private const string PREFIX = "kuz1:";
        private const int NONCESIZE = 16;
        private readonly byte[] _key;
        private readonly CounterMode_CTR_ _cipher;

        public SecurityHelper(IConfiguration config, JwtKeyProvider jwtKeyProvider)
        {
            _config = config ?? throw new ArgumentNullException(nameof(config));
            _jwtKeyProvider = jwtKeyProvider ?? throw new ArgumentNullException(nameof(jwtKeyProvider));

            var keyBase64 = _config["TotpEncryption:Key"] ?? Environment.GetEnvironmentVariable("TOTP_ENCRYPTION_KEY");

            if (string.IsNullOrWhiteSpace(keyBase64))
                throw new InvalidOperationException("Key with a base64-encoded 32-byte key.");

            _key = Convert.FromBase64String(keyBase64);
            if (_key.Length != 32)
                throw new InvalidOperationException("Key must decode to exactly 32 bytes.");

            _cipher = new CounterMode_CTR_(_key, LinearTransformImplementation.MatrixTables);

        }

        public string GenerateJwtToken(User user, Guid sessionId, string jwtId)
        {
            var creds = _jwtKeyProvider.CreateSigningCredentials();

            var claims = new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, user.Username),
                new Claim(JwtRegisteredClaimNames.Jti, jwtId),
                new Claim("userId", user.Id.ToString()),
                new Claim("sid", sessionId.ToString())
            };

            var token = new JwtSecurityToken(
                _config["Jwt:Issuer"],
                _config["Jwt:Audience"],
                claims,
                expires: DateTime.UtcNow.AddHours(1),
                signingCredentials: creds);

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        public string HashPassword(string password, string salt)
        {
            using (var sha256 = SHA256.Create())
            {
                string saltedPassword = password + salt;
                byte[] bytes = Encoding.UTF8.GetBytes(saltedPassword);

                byte[] hashBytes = sha256.ComputeHash(bytes);

                return Convert.ToHexString(hashBytes);
            }
        }

        public bool VerifyPassword(string password, string hashedPassword, string salt)
        {
            using (var sha256 = SHA256.Create())
            {
                string saltedPassword = password + salt;
                byte[] bytes = Encoding.UTF8.GetBytes(saltedPassword);

                byte[] hashBytes = sha256.ComputeHash(bytes);
                string computedHash = Convert.ToHexString(hashBytes);

                return computedHash == hashedPassword;
            }
        }

        public string GenerateTempToken(User user)
        {
            var claims = new[]
            {
                new Claim("userId", user.Id.ToString()),
                new Claim("type", "temp")
            };

            var creds = _jwtKeyProvider.CreateSigningCredentials();

            var token = new JwtSecurityToken(
                issuer: _config["Jwt:Issuer"],
                audience: _config["Jwt:Audience"],
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(5),
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        public ClaimsPrincipal ValidateToken(string token, bool requireTempToken = false)
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            var parameters = new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = _jwtKeyProvider.ValidationKey,
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidIssuer = _config["Jwt:Issuer"],
                ValidAudience = _config["Jwt:Audience"],
                ClockSkew = TimeSpan.Zero
            };

            var principal = tokenHandler.ValidateToken(token, parameters, out _);
            if (requireTempToken && principal.FindFirst("type")?.Value != "temp")
            {
                throw new SecurityTokenException("Invalid token type");
            }

            return principal;
        }
        public string Protect(string plainText)
        {
            var plainBytes = Encoding.UTF8.GetBytes(plainText);
            var nonce = RandomNumberGenerator.GetBytes(NONCESIZE);
            var cipherBytes = _cipher.Encrypt(plainBytes, nonce);

            return $"{PREFIX}{Convert.ToBase64String(nonce)}:{Convert.ToBase64String(cipherBytes)}";
        }
        public string Unprotect(string storedValue)
        {
            if (!storedValue.StartsWith(PREFIX, StringComparison.Ordinal))
            {
                return storedValue;
            }

            var payload = storedValue[PREFIX.Length..];
            var separatorIndex = payload.IndexOf(':');
            if (separatorIndex <= 0)
            {
                throw new CryptographicException("Invalid encrypted TOTP secret format.");
            }

            var nonce = Convert.FromBase64String(payload[..separatorIndex]);
            var cipherBytes = Convert.FromBase64String(payload[(separatorIndex + 1)..]);

            var plainBytes = _cipher.Decrypt(cipherBytes, nonce);

            return Encoding.UTF8.GetString(plainBytes);
        }
    }
}
