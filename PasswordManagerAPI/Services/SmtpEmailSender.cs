using Microsoft.Extensions.Configuration;
using PasswordManagerAPI.Models;
using System.Net;
using System.Net.Mail;

namespace PasswordManagerAPI.Services
{
    public class SmtpEmailSender : IEmailSender
    {
        private readonly IConfiguration _configuration;
        private readonly IWebHostEnvironment _environment;
        private readonly ILogger<SmtpEmailSender> _logger;

        public SmtpEmailSender(IConfiguration configuration, IWebHostEnvironment environment, ILogger<SmtpEmailSender> logger)
        {
            _configuration = configuration;
            _environment = environment;
            _logger = logger;
        }

        public async Task<EmailDispatchResult> SendAsync(string recipientEmail, string subject, string body, string fallbackCode)
        {
            var host = _configuration["Smtp:Host"];
            var from = _configuration["Smtp:From"];

            if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(from))
            {
                _logger.LogWarning("SMTP is not configured. Email to {RecipientEmail} was not sent.", recipientEmail);
                return new EmailDispatchResult
                {
                    Delivered = false,
                    PreviewCode = _environment.IsDevelopment() ? fallbackCode : null
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

            using var message = new MailMessage(from, recipientEmail, subject, body);
            await client.SendMailAsync(message);

            return new EmailDispatchResult { Delivered = true };
        }
    }
}
