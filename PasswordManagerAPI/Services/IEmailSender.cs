using PasswordManagerAPI.Models;

namespace PasswordManagerAPI.Services
{
    public interface IEmailSender
    {
        Task<EmailDispatchResult> SendAsync(string recipientEmail, string subject, string body);
    }
}
