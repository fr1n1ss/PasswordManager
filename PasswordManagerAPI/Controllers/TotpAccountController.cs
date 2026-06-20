using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using PasswordManagerAPI.Entities;
using PasswordManagerAPI.Models;
using PasswordManagerAPI.Services;
using SixLabors.ImageSharp;

namespace PasswordManagerAPI.Controllers
{
    [Authorize]
    [Route("api/totpAccount")]
    [ApiController]
    public class TotpAccountController : Controller
    {
        private readonly AppDbContext _context;
        private readonly IQrReaderService _qrCodeService;

        public TotpAccountController(AppDbContext context, IQrReaderService readerService)
        {
            _context = context;
            _qrCodeService = readerService;
        }

        [HttpPost("addEncrypted")]
        public IActionResult AddEncrypted([FromBody] AddEncryptedTotpAccountModel model)
        {
            if (string.IsNullOrWhiteSpace(model.EncryptedPayload) || string.IsNullOrWhiteSpace(model.Nonce))
            {
                return BadRequest("Зашифрованные данные и nonce обязательны.");
            }

            var userId = int.Parse(User.FindFirst("userId")?.Value ?? throw new UnauthorizedAccessException("User ID not found in token"));

            var account = new TotpAccount
            {
                UserId = userId,
                ServiceName = $"encrypted-totp-v{model.Version}",
                Issuer = model.Nonce,
                Secret = $"zk1:{model.EncryptedPayload}",
                Digits = 0,
                Period = 0
            };

            _context.TotpAccounts.Add(account);
            _context.SaveChanges();

            return Ok(account);
        }

        [HttpPost("importQrText")]
        [Consumes("multipart/form-data")]
        [EnableRateLimiting("QrImport")]
        public IActionResult ImportQrText(IFormFile file)
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest("Файл не загружен.");
            }

            if (file.Length > 5 * 1024 * 1024)
            {
                return BadRequest("Файл слишком большой.");
            }

            string? qrText;
            try
            {
                using var stream = file.OpenReadStream();
                qrText = _qrCodeService.ReadQrCode(stream);
            }
            catch (UnknownImageFormatException)
            {
                return BadRequest("Неподдерживаемый формат изображения.");
            }
            catch (InvalidImageContentException)
            {
                return BadRequest("Не удалось прочитать изображение.");
            }

            if (string.IsNullOrEmpty(qrText))
            {
                return BadRequest("QR-код не распознан.");
            }

            return Ok(new { qrText });
        }

        [HttpGet("getAccounts")]
        public IActionResult GetAccounts()
        {
            var userId = int.Parse(User.FindFirst("userId")?.Value ?? throw new UnauthorizedAccessException("User ID not found in token"));
            var accounts = _context.TotpAccounts.Where(a => a.UserId == userId).ToList();

            return Ok(accounts);
        }

        [HttpDelete("deleteAccount")]
        public IActionResult DeleteAccount(int accountId)
        {
            var userId = int.Parse(User.FindFirst("userId")?.Value ?? throw new UnauthorizedAccessException("User ID not found in token"));
            var account = _context.TotpAccounts.FirstOrDefault(a => a.Id == accountId && a.UserId == userId);

            if (account == null)
            {
                return NotFound(new { message = "TOTP-аккаунт не найден." });
            }

            _context.TotpAccounts.Remove(account);
            _context.SaveChanges();

            return Ok(new { deleted = true });
        }
    }
}
