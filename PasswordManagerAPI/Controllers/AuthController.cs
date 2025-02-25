using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using PasswordManagerAPI.Entities;
using PasswordManagerAPI.Models;
using PasswordManagerAPI.Services;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace PasswordManagerAPI.Controllers
{
    [Route("api/auth")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _config;

        public AuthController(AppDbContext context, IConfiguration config)
        {
            _context = context;
            _config = config;
        }

        [HttpPost("login")]
        public IActionResult Login([FromBody] LoginModel model)
        {
            var user = _context.Users.FirstOrDefault(u => u.Username == model.Username);

            if (user == null || !VerifyPassword(model.PasswordHash, user.PasswordHash, user.Salt))
            {
                return Unauthorized(new { message = "Неверный логин или пароль" });
            }

            var token = GenerateJwtToken(user);
            return Ok(new { token });
        }

        [HttpPost("register")]
        public IActionResult Register([FromBody] RegisterModel model)
        {
            var user = _context.Users.FirstOrDefault(u => u.Username == model.Username);

            if (user != null)
                return BadRequest("User already exists.");

            if (model.Username == null || model.Username == string.Empty)
                return BadRequest("Enter username");
            
            if(model.Password == null || model.Password == string.Empty)
                return BadRequest("No password was entered");
            
            if(model.Email == null || model.Email == string.Empty)
                return BadRequest("No email was entered");

            var salt = GenerateSalt();

            user = new User
            {
                Username = model.Username,
                Email = model.Email,
                Salt = salt,
                PasswordHash = HashPassword(model.Password, salt),

            };

            _context.Users.Add(user);

            _context.SaveChanges();

            return Ok("Registration successful! You can log in now.");
        }

        private string GenerateJwtToken(User user)
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

        private string HashPassword(string password, string salt)
        {
            using (var sha256 = SHA256.Create())
            {
                // Объединяем пароль и соль
                string saltedPassword = password + salt;
                byte[] bytes = Encoding.UTF8.GetBytes(saltedPassword);

                // Вычисляем хэш
                byte[] hashBytes = sha256.ComputeHash(bytes);

                // Преобразуем хэш в строку (hex-формат)
                return Convert.ToHexString(hashBytes);
            }
        }

        private string GenerateSalt()
        {
            byte[] saltBytes = new byte[16]; // 16 байт — стандартный размер соли
            using (var rng = RandomNumberGenerator.Create())
            {
                rng.GetBytes(saltBytes); // Заполняем случайными байтами
            }
            return Convert.ToBase64String(saltBytes);
        }

        private bool VerifyPassword(string password, string hashedPassword, string salt)
        {
            using (var sha256 = SHA256.Create())
            {
                // Объединяем введённый пароль с сохранённой солью
                string saltedPassword = password + salt;
                byte[] bytes = Encoding.UTF8.GetBytes(saltedPassword);

                // Вычисляем хэш введённого пароля
                byte[] hashBytes = sha256.ComputeHash(bytes);
                string computedHash = Convert.ToHexString(hashBytes);

                // Сравниваем с сохранённым хэшем
                return computedHash == hashedPassword;
            }
        }
    }
}
