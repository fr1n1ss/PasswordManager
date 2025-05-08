using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using PasswordManagerAPI.Entities;
using PasswordManagerAPI.Models;
using PasswordManagerAPI.Services;
using RSAEncryptions;
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
        private readonly SecurityHelper _securityHelper;

        public AuthController(AppDbContext context, IConfiguration config)
        {
            _context = context;
            _config = config;
            _securityHelper = new SecurityHelper(_config);
        }

        [HttpPost("login")]
        public IActionResult Login([FromBody] LoginModel model)
        {
            var user = _context.Users.FirstOrDefault(u => u.Username == model.Username);

            if (user == null || !_securityHelper.VerifyPassword(model.Password, user.PasswordHash, user.Salt))
            {
                return Unauthorized(new { message = "Неверный логин или пароль" });
            }

            var token = _securityHelper.GenerateJwtToken(user);
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

            if (model.MasterPassword == null || model.MasterPassword == string.Empty)
                return BadRequest("No master password was entered");

            var rsa = new RSAEncryption();

            var salt = _securityHelper.GenerateSalt();

            string encryptedPrivateKey = RsaKeyManager.EncryptPrivateKey(rsa.PrivateKey, model.MasterPassword, salt);


            user = new User
            {
                Username = model.Username,
                Email = model.Email,
                Salt = salt,
                PasswordHash = _securityHelper.HashPassword(model.Password, salt),
                EncryptedPrivateKey = encryptedPrivateKey,
                PublicKey = rsa.PublicKey.ToString(),
                Modulus = rsa.Modulus.ToString()
            };

            _context.Users.Add(user);

            _context.SaveChanges();

            return Ok("Registration successful! You can log in now.");
        }

        [HttpGet("ping")]
        public IActionResult Ping()
        {
            return Ok(new { status = "ok" });
        }
    }
}
