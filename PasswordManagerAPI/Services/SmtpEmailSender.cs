using Microsoft.Extensions.Configuration;
using PasswordManagerAPI.Models;
using System.Net;
using System.Net.Mail;

namespace PasswordManagerAPI.Services
{
    public class SmtpEmailSender : IEmailSender
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<SmtpEmailSender> _logger;

        public SmtpEmailSender(IConfiguration configuration, ILogger<SmtpEmailSender> logger)
        {
            _configuration = configuration;
            _logger = logger;
        }

        public async Task<EmailDispatchResult> SendAsync(string recipientEmail, string subject, string body)
        {
            var host = _configuration["Smtp:Host"];
            var from = _configuration["Smtp:From"];

            if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(from))
            {
                _logger.LogWarning("SMTP is not configured. Email to {RecipientEmail} was not sent.", recipientEmail);
                return new EmailDispatchResult
                {
                    Delivered = false
                };
            }

            var port = int.TryParse(_configuration["Smtp:Port"], out var parsedPort) ? parsedPort : 587;
            var username = _configuration["Smtp:Username"];
            var password = _configuration["Smtp:Password"];
            var enableSsl = !bool.TryParse(_configuration["Smtp:EnableSsl"], out var parsedEnableSsl) || parsedEnableSsl;

            using var client = new SmtpClient(host, port)
            {
                EnableSsl = enableSsl
            };

            if (!string.IsNullOrWhiteSpace(username))
            {
                client.Credentials = new NetworkCredential(username, password);
            }

            try
            {
                using var message = new MailMessage(from, recipientEmail, subject, body);
                await client.SendMailAsync(message);
                return new EmailDispatchResult { Delivered = true };
            }
            catch (SmtpException exception)
            {
                _logger.LogError(exception, "SMTP failed to send email to {RecipientEmail}.", recipientEmail);
                return new EmailDispatchResult { Delivered = false };
            }
        }
    }
}
