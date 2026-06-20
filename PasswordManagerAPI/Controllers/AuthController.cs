using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
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
        private readonly PasswordPolicyService _passwordPolicyService;
        private readonly IEmailVerificationService _emailVerificationService;

        public AuthController(AppDbContext context, SecurityHelper securityHelper, ITotpService totpService, IAuditService auditService, PasswordPolicyService passwordPolicyService, IEmailVerificationService emailVerificationService)
        {
            _context = context;
            _securityHelper = securityHelper;
            _totpService = totpService;
            _auditService = auditService;
            _passwordPolicyService = passwordPolicyService;
            _emailVerificationService = emailVerificationService;
        }

        [HttpPost("login")]
        [EnableRateLimiting("Auth")]
        public async Task<IActionResult> Login([FromBody] LoginModel model)
        {
            var login = model.Username?.Trim();

            if (string.IsNullOrWhiteSpace(login) ||
                UserInputLimits.IsTooLong(login, UserInputLimits.EmailMaxLength) ||
                string.IsNullOrWhiteSpace(model.Password) ||
                UserInputLimits.IsTooLong(model.Password, UserInputLimits.AuthPasswordMaxLength))
            {
                await _auditService.LogAsync("login_failed", details: $"login={login}");
                return Unauthorized(new { message = "Неверный логин или пароль" });
            }

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Username == login || u.Email == login);

            if (user == null || !_securityHelper.VerifyPassword(model.Password, user.PasswordHash, user.Salt))
            {
                await _auditService.LogAsync("login_failed", details: $"login={login}");
                return Unauthorized(new { message = "Неверный логин или пароль" });
            }

            if (!user.EmailConfirmed)
            {
                var result = await _emailVerificationService.SendCodeAsync(user.Id, user.Email, "confirm-email");
                await _auditService.LogAsync("login_email_not_confirmed", user.Id, details: $"email={user.Email}");
                return StatusCode(StatusCodes.Status403Forbidden, new
                {
                    message = "Email не подтвержден. Введите код подтверждения из письма.",
                    emailConfirmationRequired = true,
                    email = user.Email,
                    result.Delivered
                });
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
        [EnableRateLimiting("Auth")]
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
        [EnableRateLimiting("Auth")]
        public async Task<IActionResult> Register([FromBody] RegisterModel model)
        {
            var username = model.Username?.Trim();
            var email = model.Email?.Trim();

            if (string.IsNullOrWhiteSpace(username))
                return BadRequest(new { message = "Введите имя пользователя." });

            if (username.Length > UserInputLimits.UsernameMaxLength)
            {
                return BadRequest(new
                {
                    message = $"Имя пользователя должно быть не длиннее {UserInputLimits.UsernameMaxLength} символов."
                });
            }

            if (await _context.Users.AnyAsync(u => u.Username == username))
            {
                return BadRequest(new { message = "Пользователь с таким именем уже существует." });
            }

            if (string.IsNullOrWhiteSpace(model.Password))
                return BadRequest(new { message = "Введите пароль." });

            if (string.IsNullOrWhiteSpace(email))
                return BadRequest(new { message = "Введите email." });

            if (UserInputLimits.IsTooLong(email, UserInputLimits.EmailMaxLength))
                return BadRequest(new { message = $"Email должен быть не длиннее {UserInputLimits.EmailMaxLength} символов." });

            if (await _context.Users.AnyAsync(u => u.Email == email))
            {
                return BadRequest(new { message = "Пользователь с таким email уже существует." });
            }

            if (string.IsNullOrEmpty(model.Username))
                return BadRequest(new { message = "Введите имя пользователя." });

            if (string.IsNullOrEmpty(model.Password))
                return BadRequest(new { message = "Введите пароль." });

            if (string.IsNullOrEmpty(model.Email))
                return BadRequest(new { message = "Введите email." });

            if (string.IsNullOrWhiteSpace(model.Salt))
                return BadRequest(new { message = "Не передана криптографическая соль." });

            if (UserInputLimits.IsTooLong(model.Password, UserInputLimits.AuthPasswordMaxLength))
                return BadRequest(new { message = $"Пароль должен быть не длиннее {UserInputLimits.AuthPasswordMaxLength} символов." });

            if (UserInputLimits.IsTooLong(model.Salt, UserInputLimits.MasterPasswordVerifierMaxLength))
                return BadRequest(new { message = "Передана слишком длинная криптографическая соль." });

            if (UserInputLimits.IsTooLong(model.MasterPasswordVerifier, UserInputLimits.MasterPasswordVerifierMaxLength))
                return BadRequest(new { message = "Проверочные данные мастер-пароля слишком длинные." });

            var passwordValidation = _passwordPolicyService.Validate(model.Password);
            if (!passwordValidation.IsValid)
            {
                return BadRequest(new
                {
                    message = string.Join(" ", passwordValidation.Errors)
                });
            }

            var user = new User
            {
                Username = username,
                Email = email,
                EmailConfirmed = false,
                Salt = model.Salt,
                PasswordHash = _securityHelper.HashPassword(model.Password, model.Salt),
                MasterPasswordVerifier = string.IsNullOrWhiteSpace(model.MasterPasswordVerifier) ? null : model.MasterPasswordVerifier
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            var emailResult = await _emailVerificationService.SendCodeAsync(user.Id, user.Email, "confirm-email");
            await _auditService.LogAsync("register_success", user.Id, details: $"username={user.Username}");

            return Ok(new
            {
                registered = true,
                emailConfirmationRequired = true,
                email = user.Email,
                emailResult.Delivered,
                message = "Регистрация завершена. Подтвердите email перед входом."
            });
        }

        [HttpPost("confirm-registration-email")]
        [EnableRateLimiting("Auth")]
        public async Task<IActionResult> ConfirmRegistrationEmail([FromBody] ConfirmRegistrationEmailModel model)
        {
            var email = model.Email?.Trim();
            var code = model.Code?.Trim();

            if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(code))
                return BadRequest(new { message = "Email и код подтверждения обязательны." });

            if (UserInputLimits.IsTooLong(email, UserInputLimits.EmailMaxLength))
                return BadRequest(new { message = $"Email должен быть не длиннее {UserInputLimits.EmailMaxLength} символов." });

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
            if (user == null)
                return BadRequest(new { message = "Неверный код подтверждения." });

            var verifiedEmail = await _emailVerificationService.VerifyCodeAsync(user.Id, "confirm-email", code);
            if (verifiedEmail == null || !string.Equals(verifiedEmail, user.Email, StringComparison.OrdinalIgnoreCase))
            {
                await _auditService.LogAsync("email_confirmation_failed", user.Id);
                return BadRequest(new { message = "Код подтверждения неверный или истек." });
            }

            user.EmailConfirmed = true;
            await _context.SaveChangesAsync();
            await _auditService.LogAsync("email_confirmed", user.Id, details: $"email={user.Email}");
            return Ok(new { confirmed = true });
        }

        [HttpPost("resend-registration-email")]
        [EnableRateLimiting("Auth")]
        public async Task<IActionResult> ResendRegistrationEmail([FromBody] RequestPasswordResetModel model)
        {
            var email = model.Email?.Trim();
            if (string.IsNullOrWhiteSpace(email))
                return BadRequest(new { message = "Введите email." });

            if (UserInputLimits.IsTooLong(email, UserInputLimits.EmailMaxLength))
                return BadRequest(new { message = $"Email должен быть не длиннее {UserInputLimits.EmailMaxLength} символов." });

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
            if (user == null)
                return Ok(new { delivered = true });

            if (user.EmailConfirmed)
                return Ok(new { confirmed = true });

            var result = await _emailVerificationService.SendCodeAsync(user.Id, user.Email, "confirm-email");
            await _auditService.LogAsync("email_confirmation_requested", user.Id, details: $"email={user.Email}");
            return Ok(result);
        }

        [HttpPost("forgot-password")]
        [EnableRateLimiting("Auth")]
        public async Task<IActionResult> ForgotPassword([FromBody] RequestPasswordResetModel model)
        {
            var email = model.Email?.Trim();
            if (string.IsNullOrWhiteSpace(email))
                return BadRequest(new { message = "Введите email." });

            if (UserInputLimits.IsTooLong(email, UserInputLimits.EmailMaxLength))
                return BadRequest(new { message = $"Email должен быть не длиннее {UserInputLimits.EmailMaxLength} символов." });

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
            if (user == null || !user.EmailConfirmed)
            {
                return Ok(new { delivered = true });
            }

            var result = await _emailVerificationService.SendCodeAsync(user.Id, user.Email, "password-reset");
            await _auditService.LogAsync("password_reset_requested", user.Id, details: $"email={user.Email}");
            return Ok(result);
        }

        [HttpPost("reset-password")]
        [EnableRateLimiting("Auth")]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordModel model)
        {
            var email = model.Email?.Trim();
            var code = model.Code?.Trim();

            if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(code) || string.IsNullOrWhiteSpace(model.NewPassword))
                return BadRequest(new { message = "Email, код и новый пароль обязательны." });

            if (UserInputLimits.IsTooLong(email, UserInputLimits.EmailMaxLength))
                return BadRequest(new { message = $"Email должен быть не длиннее {UserInputLimits.EmailMaxLength} символов." });

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
            if (user == null || !user.EmailConfirmed)
                return BadRequest(new { message = "Код восстановления неверный или истек." });

            var verifiedEmail = await _emailVerificationService.VerifyCodeAsync(user.Id, "password-reset", code);
            if (verifiedEmail == null || !string.Equals(verifiedEmail, user.Email, StringComparison.OrdinalIgnoreCase))
            {
                await _auditService.LogAsync("password_reset_failed", user.Id);
                return BadRequest(new { message = "Код восстановления неверный или истек." });
            }

            if (UserInputLimits.IsTooLong(model.NewPassword, UserInputLimits.AuthPasswordMaxLength))
                return BadRequest(new { message = $"Пароль должен быть не длиннее {UserInputLimits.AuthPasswordMaxLength} символов." });

            var passwordValidation = _passwordPolicyService.Validate(model.NewPassword);
            if (!passwordValidation.IsValid)
            {
                return BadRequest(new { message = string.Join(" ", passwordValidation.Errors) });
            }

            user.PasswordHash = _securityHelper.HashPassword(model.NewPassword, user.Salt);
            var activeSessions = await _context.UserSessions
                .Where(x => x.UserId == user.Id && x.RevokedAt == null)
                .ToListAsync();
            var now = DateTime.UtcNow;
            foreach (var session in activeSessions)
            {
                session.RevokedAt = now;
                session.RevokedReason = "password_reset";
            }

            await _context.SaveChangesAsync();
            await _auditService.LogAsync("password_reset_success", user.Id);
            return Ok(new { reset = true });
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

            if (UserInputLimits.IsTooLong(model.CurrentPassword, UserInputLimits.AuthPasswordMaxLength) ||
                UserInputLimits.IsTooLong(model.NewPassword, UserInputLimits.AuthPasswordMaxLength))
                return BadRequest(new { message = $"Пароль должен быть не длиннее {UserInputLimits.AuthPasswordMaxLength} символов." });

            if (!_securityHelper.VerifyPassword(model.CurrentPassword, user.PasswordHash, user.Salt))
            {
                await _auditService.LogAsync("change_password_failed", userId, sessionId, "Неверный текущий пароль");
                return BadRequest(new { message = "Текущий пароль указан неверно" });
            }

            if (model.CurrentPassword == model.NewPassword)
                return BadRequest(new { message = "Новый пароль должен отличаться от текущего" });

            var passwordValidation = _passwordPolicyService.Validate(model.NewPassword);
            if (!passwordValidation.IsValid)
            {
                return BadRequest(new
                {
                    message = string.Join(" ", passwordValidation.Errors)
                });
            }

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
        [HttpPost("master-password-verifier")]
        public async Task<IActionResult> UpdateMasterPasswordVerifier([FromBody] UpdateMasterPasswordVerifierModel model)
        {
            var userId = GetCurrentUserId();
            var sessionId = GetCurrentSessionId();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null)
                return Unauthorized();

            if (UserInputLimits.IsTooLong(model.MasterPasswordVerifier, UserInputLimits.MasterPasswordVerifierMaxLength))
                return BadRequest(new { message = "Проверочные данные мастер-пароля слишком длинные." });

            user.MasterPasswordVerifier = string.IsNullOrWhiteSpace(model.MasterPasswordVerifier)
                ? null
                : model.MasterPasswordVerifier;
            await _context.SaveChangesAsync();
            await _auditService.LogAsync(
                string.IsNullOrWhiteSpace(model.MasterPasswordVerifier) ? "master_password_verifier_cleared" : "master_password_verifier_updated",
                userId,
                sessionId);

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
        [EnableRateLimiting("Auth")]
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
                return BadRequest("Неверный код 2FA.");
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

            var accountsJson = System.Text.Json.JsonSerializer.Serialize(accounts);
            var notesJson = System.Text.Json.JsonSerializer.Serialize(notes);

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
