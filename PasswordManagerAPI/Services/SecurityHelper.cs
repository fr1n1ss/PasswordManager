using System;
using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.Extensions.Configuration;
using global::PasswordManagerAPI.Entities;
using System.Security.Claims;

namespace PasswordManagerAPI.Services
{

    public class SecurityHelper
    {
        private readonly IConfiguration _config;
        private readonly JwtKeyProvider _jwtKeyProvider;

        public SecurityHelper(IConfiguration config, JwtKeyProvider jwtKeyProvider)
        {
            _config = config ?? throw new ArgumentNullException(nameof(config));
            _jwtKeyProvider = jwtKeyProvider ?? throw new ArgumentNullException(nameof(jwtKeyProvider));
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
    }
}
