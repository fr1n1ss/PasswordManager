using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Newtonsoft.Json;
using PasswordManagerAPI.Entities;
using PasswordManagerAPI.Models;
using PasswordManagerAPI.Services;
using Security.RSA;
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
        private readonly ITotpService _totpService;

        public AuthController(AppDbContext context, IConfiguration config, ITotpService totpService)
        {
            _context = context;
            _config = config;
            _securityHelper = new SecurityHelper(_config);
            _totpService = totpService;
        }

        [HttpPost("login")]
        public IActionResult Login([FromBody] LoginModel model)
        {
            var user = _context.Users.FirstOrDefault(u => u.Username == model.Username);

            if (user == null || !_securityHelper.VerifyPassword(model.Password, user.PasswordHash, user.Salt))
            {
                return Unauthorized(new { message = "Неверный логин или пароль" });
            }

            if (user.Is2FaEnabled)
            {
                var tempToken = _securityHelper.GenerateTempToken(user);
                return Ok(new { requires2FA = true, tempToken });
            }

            var token = _securityHelper.GenerateJwtToken(user);
            return Ok(new { token });
        }

        [HttpPost("2fa/login")]
        public IActionResult LoginWith2FA([FromBody] TwoFactorRequest request)
        {
            var handler = new JwtSecurityTokenHandler();
            var jwt = handler.ReadJwtToken(request.TempToken);

            var type = jwt.Claims.FirstOrDefault(c => c.Type == "type")?.Value;
            if (type != "temp")
                return Unauthorized("Invalid token type");

            var userId = int.Parse(jwt.Claims.First(c => c.Type == "userId").Value);
            var user = _context.Users.FirstOrDefault(u => u.Id == userId);
            if (user == null)
                return Unauthorized();

            bool isValid = _totpService.Validate(user.TotpSecret, request.Code);
            if (!isValid)
                return Unauthorized(new { message = "Invalid 2FA code" });

            var token = _securityHelper.GenerateJwtToken(user);
            return Ok(new { token });
        }

        [HttpPost("register")]
        public IActionResult Register([FromBody] RegisterModel model)
        {
            var user = _context.Users.FirstOrDefault(u => u.Username == model.Username);

            if (user != null)
                return BadRequest("User already exists.");

            if (string.IsNullOrEmpty(model.Username))
                return BadRequest("Enter username");

            if (string.IsNullOrEmpty(model.Password))
                return BadRequest("No password was entered");

            if (string.IsNullOrEmpty(model.Email))
                return BadRequest("No email was entered");

            if (string.IsNullOrEmpty(model.MasterPassword))
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

        [Authorize]
        [HttpPost("validate-master-password")]
        public IActionResult ValidateMasterPassword([FromBody] ValidateMasterPasswordModel model)
        {
            var userId = int.Parse(User.FindFirst("userId")?.Value ?? throw new UnauthorizedAccessException("User ID not found in token"));
            var user = _context.Users.FirstOrDefault(u => u.Id == userId);

            if (user == null)
                return Unauthorized();

            if (string.IsNullOrWhiteSpace(model.MasterPassword))
                return BadRequest("Master password is required");

            try
            {
                _ = RsaKeyManager.DecryptPrivateKey(user.EncryptedPrivateKey, model.MasterPassword, user.Salt);
                return Ok(new { valid = true });
            }
            catch
            {
                return Unauthorized(new { message = "Invalid master password" });
            }
        }

        [Authorize]
        [HttpPost("2fa/setup")]
        public IActionResult Setup2FA()
        {
            var userId = int.Parse(User.FindFirst("userId")?.Value ?? throw new UnauthorizedAccessException("User ID not found in token"));
            var user = _context.Users.FirstOrDefault(u => u.Id == userId);

            var (secret, uri) = _totpService.GenerateTotpSecret(user.Username);
            user.TotpSecret = secret;
            _context.SaveChanges();

            return Ok(new { uri });
        }

        [Authorize]
        [HttpPost("2fa/verify")]
        public IActionResult Verify2FA([FromBody] string code)
        {
            var userId = int.Parse(User.FindFirst("userId")?.Value ?? throw new UnauthorizedAccessException("User ID not found in token"));
            var user = _context.Users.FirstOrDefault(u => u.Id == userId);

            if (user.TotpSecret == null)
                return BadRequest("2FA setup not initiated.");

            bool isValid = _totpService.Validate(user.TotpSecret, code);
            if (!isValid)
                return BadRequest("Invalid 2FA code.");

            user.Is2FaEnabled = true;
            _context.SaveChanges();

            return Ok("2FA enabled successfully.");
        }

        [HttpGet("ping")]
        public IActionResult Ping()
        {
            return Ok(new { status = "ok" });
        }

        [HttpGet("hashes")]
        [Authorize]
        public async Task<IActionResult> GetDataHashes()
        {
            var userId = int.Parse(User.FindFirst("userId")?.Value ?? throw new UnauthorizedAccessException("User ID not found in token"));

            var accounts = await _context.Accounts.Where(u => u.UserID == userId).ToListAsync();
            var notes = await _context.Notes.Where(n => n.UserID == userId).ToListAsync();

            string accountsJson = JsonConvert.SerializeObject(accounts);
            string notesJson = JsonConvert.SerializeObject(notes);

            using var sha256 = SHA256.Create();
            var accountsHash = Convert.ToHexString(sha256.ComputeHash(Encoding.UTF8.GetBytes(accountsJson)));
            var notesHash = Convert.ToHexString(sha256.ComputeHash(Encoding.UTF8.GetBytes(notesJson)));

            return Ok(new
            {
                accountsHash = accountsHash.ToLower(),
                notesHash = notesHash.ToLower()
            });
        }
    }
}
