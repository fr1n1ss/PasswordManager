using PasswordManagerAPI.Models;

namespace PasswordManagerAPI.Services
{
    public interface IEmailVerificationService
    {
        Task<EmailDispatchResult> SendCodeAsync(int userId, string targetEmail, string purpose);
        Task<string?> VerifyCodeAsync(int userId, string purpose, string code);
    }
}
