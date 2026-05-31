using Microsoft.EntityFrameworkCore;
using PasswordManagerAPI.Entities;
using PasswordManagerAPI.Models;
using System.Security.Cryptography;
using System.Text;

namespace PasswordManagerAPI.Services
{
    public class EmailVerificationService : IEmailVerificationService
    {
        private readonly AppDbContext _context;
        private readonly IEmailSender _emailSender;

        public EmailVerificationService(AppDbContext context, IEmailSender emailSender)
        {
            _context = context;
            _emailSender = emailSender;
        }

        public async Task<EmailDispatchResult> SendCodeAsync(int userId, string targetEmail, string purpose)
        {
            var code = RandomNumberGenerator.GetInt32(100000, 999999).ToString();
            var now = DateTime.UtcNow;

            var activeCodes = await _context.EmailVerificationCodes
                .Where(x => x.UserId == userId && x.Purpose == purpose && x.ConsumedAt == null)
                .ToListAsync();

            foreach (var activeCode in activeCodes)
            {
                activeCode.ConsumedAt = now;
            }

            _context.EmailVerificationCodes.Add(new EmailVerificationCode
            {
                UserId = userId,
                Purpose = purpose,
                TargetEmail = targetEmail,
                CodeHash = ComputeHash(code),
                CreatedAt = now,
                ExpiresAt = now.AddMinutes(10)
            });

            await _context.SaveChangesAsync();

            var subject = purpose switch
            {
                "change-email" => "Подтверждение смены email",
                "password-reset" => "Код восстановления пароля",
                _ => "Подтверждение email"
            };
            var body = $"Ваш код подтверждения: {code}\n\nКод действует 10 минут.";
            return await _emailSender.SendAsync(targetEmail, subject, body);
        }

        public async Task<string?> VerifyCodeAsync(int userId, string purpose, string code)
        {
            var codeHash = ComputeHash(code);
            var now = DateTime.UtcNow;

            var record = await _context.EmailVerificationCodes
                .Where(x => x.UserId == userId
                    && x.Purpose == purpose
                    && x.ConsumedAt == null
                    && x.ExpiresAt > now)
                .OrderByDescending(x => x.CreatedAt)
                .FirstOrDefaultAsync(x => x.CodeHash == codeHash);

            if (record == null)
            {
                return null;
            }

            record.ConsumedAt = now;
            await _context.SaveChangesAsync();
            return record.TargetEmail;
        }

        private static string ComputeHash(string value)
        {
            using var sha256 = SHA256.Create();
            var bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(value));
            return Convert.ToHexString(bytes);
        }
    }
}
