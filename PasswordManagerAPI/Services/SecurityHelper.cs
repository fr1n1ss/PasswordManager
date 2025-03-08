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

            public SecurityHelper(IConfiguration config)
            {
                _config = config ?? throw new ArgumentNullException(nameof(config));
            }

            // Генерация JWT-токена
            public string GenerateJwtToken(User user)
            {
                var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]));
                var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

                var claims = new[]
                {
                new Claim(JwtRegisteredClaimNames.Sub, user.Username),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
                new Claim("userId", user.Id.ToString())
            };

                var token = new JwtSecurityToken(
                    _config["Jwt:Issuer"],
                    _config["Jwt:Audience"],
                    claims,
                    expires: DateTime.UtcNow.AddHours(1),
                    signingCredentials: creds);

                return new JwtSecurityTokenHandler().WriteToken(token);
            }

            // Хэширование пароля с солью (с итерациями для безопасности)
            public string HashPassword(string password, string salt, int iterations = 1000)
            {
                byte[] passwordBytes = Encoding.UTF8.GetBytes(password);
                byte[] saltBytes = Convert.FromBase64String(salt);
                byte[] combined = new byte[passwordBytes.Length + saltBytes.Length];

                Buffer.BlockCopy(passwordBytes, 0, combined, 0, passwordBytes.Length);
                Buffer.BlockCopy(saltBytes, 0, combined, passwordBytes.Length, saltBytes.Length);

                using (var sha256 = SHA256.Create())
                {
                    byte[] hash = combined;
                    for (int i = 0; i < iterations; i++)
                    {
                        hash = sha256.ComputeHash(hash); // Многократное хэширование
                    }
                    return Convert.ToHexString(hash);
                }
            }

            // Генерация соли
            public string GenerateSalt()
            {
                byte[] saltBytes = new byte[16];
                using (var rng = RandomNumberGenerator.Create())
                {
                    rng.GetBytes(saltBytes);
                }
                return Convert.ToBase64String(saltBytes);
            }

            // Проверка пароля
            public bool VerifyPassword(string password, string hashedPassword, string salt)
            {
                string computedHash = HashPassword(password, salt);
                return CryptographicOperations.FixedTimeEquals(
                    Encoding.UTF8.GetBytes(computedHash),
                    Encoding.UTF8.GetBytes(hashedPassword)); // Защищённое сравнение
            }
        }
        
}
