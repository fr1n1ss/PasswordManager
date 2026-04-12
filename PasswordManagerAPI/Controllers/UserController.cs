using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PasswordManagerAPI.Models;
using PasswordManagerAPI.Services;
using System.Net.Mail;

namespace PasswordManagerAPI.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class UserController : Controller
    {
        private readonly AppDbContext _context;
        private readonly IEmailVerificationService _emailVerificationService;
        private readonly IAuditService _auditService;

        public UserController(AppDbContext context, IEmailVerificationService emailVerificationService, IAuditService auditService)
        {
            _context = context;
            _emailVerificationService = emailVerificationService;
            _auditService = auditService;
        }

        [HttpGet("GetUserInfo")]
        public async Task<ActionResult<UserModel>> GetUserInfo()
        {
            var userId = GetCurrentUserId();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null)
                throw new ArgumentException("User with this userId not found");

            return new UserModel
            {
                Username = user.Username,
                Email = user.Email,
                EmailConfirmed = user.EmailConfirmed,
                Salt = user.Salt,
                MasterPasswordVerifier = user.MasterPasswordVerifier,
                Is2FaEnabled = user.Is2FaEnabled
            };
        }

        [HttpPost("RotateMasterPassword")]
        public async Task<IActionResult> RotateMasterPassword([FromBody] RotateMasterPasswordModel model)
        {
            var userId = GetCurrentUserId();
            var sessionId = GetCurrentSessionId();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null)
                return Unauthorized();

            model ??= new RotateMasterPasswordModel();

            var totalAccounts = await _context.Accounts.CountAsync(x => x.UserID == userId);
            var totalNotes = await _context.Notes.CountAsync(x => x.UserID == userId);
            var totalTotpAccounts = await _context.TotpAccounts.CountAsync(x => x.UserId == userId);

            if (model.Accounts.Count != totalAccounts || model.Notes.Count != totalNotes || model.TotpAccounts.Count != totalTotpAccounts)
            {
                return Conflict(new
                {
                    message = "Данные успели измениться. Обновите страницу и попробуйте снова."
                });
            }

            await using var transaction = await _context.Database.BeginTransactionAsync();

            var accountMap = model.Accounts.ToDictionary(x => x.Id);
            var noteMap = model.Notes.ToDictionary(x => x.Id);
            var totpMap = model.TotpAccounts.ToDictionary(x => x.Id);

            var accounts = await _context.Accounts.Where(x => x.UserID == userId).ToListAsync();
            foreach (var account in accounts)
            {
                if (!accountMap.TryGetValue(account.ID, out var updatedAccount) || string.IsNullOrWhiteSpace(updatedAccount.EncryptedPassword))
                {
                    return BadRequest(new { message = "Не удалось обновить зашифрованные аккаунты." });
                }

                account.EncryptedPassword = updatedAccount.EncryptedPassword;
            }

            var notes = await _context.Notes.Where(x => x.UserID == userId).ToListAsync();
            foreach (var note in notes)
            {
                if (!noteMap.TryGetValue(note.ID, out var updatedNote) || string.IsNullOrWhiteSpace(updatedNote.EncryptedContent))
                {
                    return BadRequest(new { message = "Не удалось обновить зашифрованные заметки." });
                }

                note.EncryptedContent = updatedNote.EncryptedContent;
                note.UpdatedAt = DateTime.UtcNow;
            }

            var totpAccounts = await _context.TotpAccounts.Where(x => x.UserId == userId).ToListAsync();
            foreach (var totpAccount in totpAccounts)
            {
                if (!totpMap.TryGetValue(totpAccount.Id, out var updatedTotp) ||
                    string.IsNullOrWhiteSpace(updatedTotp.EncryptedPayload) ||
                    string.IsNullOrWhiteSpace(updatedTotp.Nonce))
                {
                    return BadRequest(new { message = "Не удалось обновить зашифрованные TOTP записи." });
                }

                var version = Math.Max(1, updatedTotp.Version);
                totpAccount.ServiceName = $"encrypted-totp-v{version}";
                totpAccount.Issuer = updatedTotp.Nonce;
                totpAccount.Secret = $"zk1:{updatedTotp.EncryptedPayload}";
                totpAccount.Digits = 0;
                totpAccount.Period = 0;
            }

            if (!string.IsNullOrWhiteSpace(model.MasterPasswordVerifier))
            {
                user.MasterPasswordVerifier = model.MasterPasswordVerifier;
            }
            else if (model.ClearServerVerifier)
            {
                user.MasterPasswordVerifier = null;
            }

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            await _auditService.LogAsync(
                "master_password_rotated",
                userId,
                sessionId,
                $"accounts={accounts.Count};notes={notes.Count};totp={totpAccounts.Count};verifierUpdated={!string.IsNullOrWhiteSpace(model.MasterPasswordVerifier)};clearedVerifier={model.ClearServerVerifier}");

            return Ok(new
            {
                rotated = true,
                clearedServerVerifier = model.ClearServerVerifier
            });
        }

        [HttpPost("SendEmailConfirmation")]
        public async Task<IActionResult> SendEmailConfirmation()
        {
            var userId = GetCurrentUserId();
            var sessionId = GetCurrentSessionId();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null)
                return Unauthorized();

            var result = await _emailVerificationService.SendCodeAsync(userId, user.Email, "confirm-email");
            await _auditService.LogAsync("email_confirmation_requested", userId, sessionId, $"email={user.Email}");
            return Ok(result);
        }

        [HttpPost("VerifyEmailConfirmation")]
        public async Task<IActionResult> VerifyEmailConfirmation([FromBody] ConfirmEmailCodeModel model)
        {
            var userId = GetCurrentUserId();
            var sessionId = GetCurrentSessionId();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null)
                return Unauthorized();

            if (string.IsNullOrWhiteSpace(model.Code))
                return BadRequest(new { message = "Код подтверждения обязателен" });

            var verifiedEmail = await _emailVerificationService.VerifyCodeAsync(userId, "confirm-email", model.Code);
            if (verifiedEmail == null || !string.Equals(verifiedEmail, user.Email, StringComparison.OrdinalIgnoreCase))
            {
                await _auditService.LogAsync("email_confirmation_failed", userId, sessionId);
                return BadRequest(new { message = "Код подтверждения недействителен или истек" });
            }

            user.EmailConfirmed = true;
            await _context.SaveChangesAsync();
            await _auditService.LogAsync("email_confirmed", userId, sessionId, $"email={user.Email}");
            return Ok(new { confirmed = true });
        }

        [HttpPost("RequestEmailChange")]
        public async Task<IActionResult> RequestEmailChange([FromBody] RequestEmailChangeModel model)
        {
            var userId = GetCurrentUserId();
            var sessionId = GetCurrentSessionId();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null)
                return Unauthorized();

            if (string.IsNullOrWhiteSpace(model.NewEmail) || string.IsNullOrWhiteSpace(model.CurrentPassword))
                return BadRequest(new { message = "Новый email и текущий пароль обязательны" });

            if (!IsValidEmail(model.NewEmail))
                return BadRequest(new { message = "Некорректный email" });

            if (string.Equals(user.Email, model.NewEmail, StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { message = "Новый email совпадает с текущим" });

            var securityHelper = new SecurityHelper(HttpContext.RequestServices.GetRequiredService<IConfiguration>());
            if (!securityHelper.VerifyPassword(model.CurrentPassword, user.PasswordHash, user.Salt))
            {
                await _auditService.LogAsync("email_change_request_failed", userId, sessionId, "Неверный текущий пароль");
                return BadRequest(new { message = "Текущий пароль указан неверно" });
            }

            if (await _context.Users.AnyAsync(u => u.Email == model.NewEmail && u.Id != userId))
                return BadRequest(new { message = "Этот email уже используется" });

            var result = await _emailVerificationService.SendCodeAsync(userId, model.NewEmail, "change-email");
            await _auditService.LogAsync("email_change_requested", userId, sessionId, $"newEmail={model.NewEmail}");
            return Ok(result);
        }

        [HttpPost("ConfirmEmailChange")]
        public async Task<IActionResult> ConfirmEmailChange([FromBody] ConfirmEmailCodeModel model)
        {
            var userId = GetCurrentUserId();
            var sessionId = GetCurrentSessionId();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);

            if (user == null)
                return Unauthorized();

            if (string.IsNullOrWhiteSpace(model.Code))
                return BadRequest(new { message = "Код подтверждения обязателен" });

            var verifiedEmail = await _emailVerificationService.VerifyCodeAsync(userId, "change-email", model.Code);
            if (verifiedEmail == null)
            {
                await _auditService.LogAsync("email_change_failed", userId, sessionId);
                return BadRequest(new { message = "Код подтверждения недействителен или истек" });
            }

            if (await _context.Users.AnyAsync(u => u.Email == verifiedEmail && u.Id != userId))
                return BadRequest(new { message = "Этот email уже используется" });

            user.Email = verifiedEmail;
            user.EmailConfirmed = true;
            await _context.SaveChangesAsync();
            await _auditService.LogAsync("email_changed", userId, sessionId, $"email={verifiedEmail}");

            return Ok(new { changed = true, email = verifiedEmail, emailConfirmed = true });
        }

        [HttpGet("GetAuditLogs")]
        public async Task<ActionResult<IEnumerable<AuditLogModel>>> GetAuditLogs([FromQuery] int take = 50)
        {
            var userId = GetCurrentUserId();
            take = Math.Clamp(take, 1, 100);

            var logs = await _context.AuditLogs
                .Where(x => x.UserId == userId)
                .OrderByDescending(x => x.CreatedAt)
                .Take(take)
                .Select(x => new AuditLogModel
                {
                    Id = x.Id,
                    Action = x.Action,
                    Details = x.Details,
                    CreatedAt = x.CreatedAt,
                    IpAddress = x.IpAddress,
                    UserAgent = x.UserAgent
                })
                .ToListAsync();

            return Ok(logs);
        }

        private int GetCurrentUserId()
        {
            return int.Parse(User.FindFirst("userId")?.Value ?? throw new UnauthorizedAccessException("User ID not found in token"));
        }

        private Guid? GetCurrentSessionId()
        {
            return Guid.TryParse(User.FindFirst("sid")?.Value, out var sessionId) ? sessionId : null;
        }

        private static bool IsValidEmail(string email)
        {
            try
            {
                _ = new MailAddress(email);
                return true;
            }
            catch
            {
                return false;
            }
        }
    }
}
