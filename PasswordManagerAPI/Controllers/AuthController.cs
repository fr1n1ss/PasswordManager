using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using PasswordManagerAPI.Entities;
using PasswordManagerAPI.Models;
using PasswordManagerAPI.Services;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Cryptography;
using System.Text;

namespace PasswordManagerAPI.Controllers
{
    [Route("api/auth")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly SecurityHelper _securityHelper;
        private readonly ITotpService _totpService;
        private readonly IAuditService _auditService;

        public AuthController(AppDbContext context, IConfiguration config, ITotpService totpService, IAuditService auditService)
        {
            _context = context;
            _securityHelper = new SecurityHelper(config);
            _totpService = totpService;
            _auditService = auditService;
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginModel model)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Username == model.Username);

            if (user == null || !_securityHelper.VerifyPassword(model.Password, user.PasswordHash, user.Salt))
            {
                await _auditService.LogAsync("login_failed", details: $"username={model.Username}");
                return Unauthorized(new { message = "Неверный логин или пароль" });
            }

            if (user.Is2FaEnabled)
            {
                await _auditService.LogAsync("login_password_verified", user.Id, details: "Требуется подтверждение 2FA");
                var tempToken = _securityHelper.GenerateTempToken(user);
                return Ok(new { requires2FA = true, tempToken });
            }

            var (sessionId, token) = await CreateSessionAsync(user);
            await _auditService.LogAsync("login_success", user.Id, sessionId, "Вход без 2FA");
            return Ok(new { token });
        }

        [HttpPost("2fa/login")]
        public async Task<IActionResult> LoginWith2FA([FromBody] TwoFactorRequest request)
        {
            try
            {
                var principal = _securityHelper.ValidateToken(request.TempToken, requireTempToken: true);
                var userId = int.Parse(principal.FindFirst("userId")?.Value ?? throw new UnauthorizedAccessException("User ID not found in token"));
                var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);

                if (user == null)
                {
                    return Unauthorized();
                }

                var isValid = _totpService.Validate(user.TotpSecret, request.Code);
                if (!isValid)
                {
                    await _auditService.LogAsync("login_2fa_failed", user.Id);
                    return Unauthorized(new { message = "Неверный код 2FA" });
                }

                var (sessionId, token) = await CreateSessionAsync(user);
                await _auditService.LogAsync("login_success", user.Id, sessionId, "Вход с 2FA");
                return Ok(new { token });
            }
            catch (Exception)
            {
                return Unauthorized(new { message = "Недействительный временный токен" });
            }
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterModel model)
        {
            if (await _context.Users.AnyAsync(u => u.Username == model.Username))
            {
                return BadRequest("User already exists.");
            }

            if (await _context.Users.AnyAsync(u => u.Email == model.Email))
            {
                return BadRequest("Email already exists.");
            }

            if (string.IsNullOrEmpty(model.Username))
                return BadRequest("Enter username");

            if (string.IsNullOrEmpty(model.Password))
                return BadRequest("No password was entered");

            if (string.IsNullOrEmpty(model.Email))
                return BadRequest("No email was entered");

            if (string.IsNullOrWhiteSpace(model.Salt))
                return BadRequest("No salt was provided");

            if (string.IsNullOrWhiteSpace(model.MasterPasswordVerifier))
                return BadRequest("No master password verifier was provided");

            var user = new User
            {
                Username = model.Username,
                Email = model.Email,
                EmailConfirmed = false,
                Salt = model.Salt,
                PasswordHash = _securityHelper.HashPassword(model.Password, model.Salt),
                EncryptedPrivateKey = string.Empty,
                PublicKey = string.Empty,
                Modulus = string.Empty,
                MasterPasswordVerifier = model.MasterPasswordVerifier
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();
            await _auditService.LogAsync("register_success", user.Id, details: $"username={user.Username}");

            return Ok("Registration successful! You can log in now.");
        }

        [Authorize]
        [HttpPost("change-password")]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordModel model)
        {
            var userId = GetCurrentUserId();
            var sessionId = GetCurrentSessionId();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null)
                return Unauthorized();

            if (string.IsNullOrWhiteSpace(model.CurrentPassword) || string.IsNullOrWhiteSpace(model.NewPassword))
                return BadRequest(new { message = "Текущий и новый пароль обязательны" });

            if (!_securityHelper.VerifyPassword(model.CurrentPassword, user.PasswordHash, user.Salt))
            {
                await _auditService.LogAsync("change_password_failed", userId, sessionId, "Неверный текущий пароль");
                return BadRequest(new { message = "Текущий пароль указан неверно" });
            }

            if (model.CurrentPassword == model.NewPassword)
                return BadRequest(new { message = "Новый пароль должен отличаться от текущего" });

            user.PasswordHash = _securityHelper.HashPassword(model.NewPassword, user.Salt);
            await _context.SaveChangesAsync();
            await _auditService.LogAsync("change_password_success", userId, sessionId);

            return Ok(new { changed = true });
        }

        [Authorize]
        [HttpGet("sessions")]
        public async Task<ActionResult<IEnumerable<UserSessionModel>>> GetSessions()
        {
            var userId = GetCurrentUserId();
            var currentSessionId = GetCurrentSessionId();

            var sessions = await _context.UserSessions
                .Where(x => x.UserId == userId && x.RevokedAt == null && x.ExpiresAt > DateTime.UtcNow)
                .OrderByDescending(x => x.LastSeenAt)
                .Select(x => new UserSessionModel
                {
                    Id = x.Id,
                    UserAgent = x.UserAgent,
                    IpAddress = x.IpAddress,
                    CreatedAt = x.CreatedAt,
                    LastSeenAt = x.LastSeenAt,
                    ExpiresAt = x.ExpiresAt,
                    IsCurrent = currentSessionId != null && x.Id == currentSessionId.Value
                })
                .ToListAsync();

            return Ok(sessions);
        }

        [Authorize]
        [HttpDelete("sessions/{sessionId:guid}")]
        public async Task<IActionResult> RevokeSession(Guid sessionId)
        {
            var userId = GetCurrentUserId();
            var currentSessionId = GetCurrentSessionId();
            var session = await _context.UserSessions.FirstOrDefaultAsync(x => x.Id == sessionId && x.UserId == userId);

            if (session == null)
                return NotFound();

            session.RevokedAt = DateTime.UtcNow;
            session.RevokedReason = sessionId == currentSessionId ? "self_logout" : "revoked_by_user";
            await _context.SaveChangesAsync();
            await _auditService.LogAsync("session_revoked", userId, currentSessionId, $"revokedSessionId={sessionId}");

            return Ok(new { revoked = true });
        }

        [Authorize]
        [HttpPost("sessions/revoke-others")]
        public async Task<IActionResult> RevokeOtherSessions()
        {
            var userId = GetCurrentUserId();
            var currentSessionId = GetCurrentSessionId();

            var sessions = await _context.UserSessions
                .Where(x => x.UserId == userId && x.RevokedAt == null && x.Id != currentSessionId)
                .ToListAsync();

            var now = DateTime.UtcNow;
            foreach (var session in sessions)
            {
                session.RevokedAt = now;
                session.RevokedReason = "revoked_other_sessions";
            }

            await _context.SaveChangesAsync();
            await _auditService.LogAsync("other_sessions_revoked", userId, currentSessionId, $"count={sessions.Count}");

            return Ok(new { revokedCount = sessions.Count });
        }

        [Authorize]
        [HttpPost("logout")]
        public async Task<IActionResult> Logout()
        {
            var userId = GetCurrentUserId();
            var sessionId = GetCurrentSessionId();

            if (sessionId == null)
                return Ok(new { loggedOut = true });

            var session = await _context.UserSessions.FirstOrDefaultAsync(x => x.Id == sessionId && x.UserId == userId);
            if (session != null && session.RevokedAt == null)
            {
                session.RevokedAt = DateTime.UtcNow;
                session.RevokedReason = "logout";
                await _context.SaveChangesAsync();
            }

            await _auditService.LogAsync("logout", userId, sessionId);
            return Ok(new { loggedOut = true });
        }

        [Authorize]
        [HttpPost("validate-master-password")]
        public IActionResult ValidateMasterPassword([FromBody] ValidateMasterPasswordModel model)
        {
            return BadRequest(new { message = "Server-side master password validation is disabled in zero-knowledge mode." });
        }

        [Authorize]
        [HttpPost("master-password-verifier")]
        public async Task<IActionResult> UpdateMasterPasswordVerifier([FromBody] UpdateMasterPasswordVerifierModel model)
        {
            var userId = GetCurrentUserId();
            var sessionId = GetCurrentSessionId();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null)
                return Unauthorized();

            if (string.IsNullOrWhiteSpace(model.MasterPasswordVerifier))
                return BadRequest("Master password verifier is required");

            user.MasterPasswordVerifier = model.MasterPasswordVerifier;
            await _context.SaveChangesAsync();
            await _auditService.LogAsync("master_password_verifier_updated", userId, sessionId);

            return Ok(new { updated = true });
        }

        [Authorize]
        [HttpPost("2fa/setup")]
        public async Task<IActionResult> Setup2FA()
        {
            var userId = GetCurrentUserId();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null)
                return Unauthorized();

            var (secret, uri) = _totpService.GenerateTotpSecret(user.Username);
            user.TotpSecret = secret;
            await _context.SaveChangesAsync();
            await _auditService.LogAsync("2fa_setup_started", userId, GetCurrentSessionId());

            return Ok(new { uri });
        }

        [Authorize]
        [HttpPost("2fa/verify")]
        public async Task<IActionResult> Verify2FA([FromBody] string code)
        {
            var userId = GetCurrentUserId();
            var sessionId = GetCurrentSessionId();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null)
                return Unauthorized();

            if (user.TotpSecret == null)
                return BadRequest("2FA setup not initiated.");

            var isValid = _totpService.Validate(user.TotpSecret, code);
            if (!isValid)
            {
                await _auditService.LogAsync("2fa_enable_failed", userId, sessionId);
                return BadRequest("Invalid 2FA code.");
            }

            user.Is2FaEnabled = true;
            await _context.SaveChangesAsync();
            await _auditService.LogAsync("2fa_enabled", userId, sessionId);

            return Ok("2FA enabled successfully.");
        }

        [Authorize]
        [HttpPost("2fa/disable")]
        public async Task<IActionResult> Disable2FA()
        {
            var userId = GetCurrentUserId();
            var sessionId = GetCurrentSessionId();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null)
                return Unauthorized();

            user.Is2FaEnabled = false;
            user.TotpSecret = null;
            await _context.SaveChangesAsync();
            await _auditService.LogAsync("2fa_disabled", userId, sessionId);

            return Ok(new { message = "2FA disabled successfully." });
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
            var userId = GetCurrentUserId();

            var accounts = await _context.Accounts.Where(u => u.UserID == userId).ToListAsync();
            var notes = await _context.Notes.Where(n => n.UserID == userId).ToListAsync();

            var accountsJson = JsonConvert.SerializeObject(accounts);
            var notesJson = JsonConvert.SerializeObject(notes);

            using var sha256 = SHA256.Create();
            var accountsHash = Convert.ToHexString(sha256.ComputeHash(Encoding.UTF8.GetBytes(accountsJson)));
            var notesHash = Convert.ToHexString(sha256.ComputeHash(Encoding.UTF8.GetBytes(notesJson)));

            return Ok(new
            {
                accountsHash = accountsHash.ToLower(),
                notesHash = notesHash.ToLower()
            });
        }

        private async Task<(Guid SessionId, string Token)> CreateSessionAsync(User user)
        {
            var sessionId = Guid.NewGuid();
            var jwtId = Guid.NewGuid().ToString("N");
            var now = DateTime.UtcNow;

            _context.UserSessions.Add(new UserSession
            {
                Id = sessionId,
                UserId = user.Id,
                JwtId = jwtId,
                UserAgent = Request.Headers.UserAgent.ToString(),
                IpAddress = RequestMetadataHelper.GetClientIp(HttpContext),
                CreatedAt = now,
                LastSeenAt = now,
                ExpiresAt = now.AddHours(1)
            });

            await _context.SaveChangesAsync();
            var token = _securityHelper.GenerateJwtToken(user, sessionId, jwtId);
            return (sessionId, token);
        }

        private int GetCurrentUserId()
        {
            return int.Parse(User.FindFirst("userId")?.Value ?? throw new UnauthorizedAccessException("User ID not found in token"));
        }

        private Guid? GetCurrentSessionId()
        {
            return Guid.TryParse(User.FindFirst("sid")?.Value, out var sessionId) ? sessionId : null;
        }
    }
}
