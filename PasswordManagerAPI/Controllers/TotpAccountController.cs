using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PasswordManagerAPI.Entities;
using PasswordManagerAPI.Services;
using Security.RSA;

namespace PasswordManagerAPI.Controllers
{
    [Authorize]
    [Route("api/totpAccount")]
    [ApiController]
    public class TotpAccountController : Controller
    {
        private readonly AppDbContext _context;
        private readonly ITotpAccountService _totpAccountService;
        private readonly RSAEncryption _rsaEncryption;
        private readonly IQrReaderService _qrCodeService;
        public TotpAccountController(AppDbContext context, ITotpAccountService totpAccountService, RSAEncryption encryption, IQrReaderService readerService)
        {
            _context = context;
            _totpAccountService = totpAccountService;
            _rsaEncryption = encryption;
            _qrCodeService = readerService;
        }
        [HttpPost("addAccount")]
        public IActionResult Add([FromBody] string uri)
        {
            var userId = int.Parse(User.FindFirst("userId")?.Value ?? throw new UnauthorizedAccessException("User ID not found in token"));

            var account = _totpAccountService.ParseOtpAuth(uri);
            account.UserId = userId;

            _context.TotpAccounts.Add(account);
            _context.SaveChanges();

            return Ok(account);
        }
        [HttpPost("import")]
        [Consumes("multipart/form-data")]
        public IActionResult Import(IFormFile file)
        {
            if (file == null || file.Length == 0) return BadRequest("File not upload");

            var userId = int.Parse(User.FindFirst("userId")?.Value ?? throw new UnauthorizedAccessException("User ID not found in token"));

            using var stream = file.OpenReadStream();

            var qrText = _qrCodeService.ReadQrCode(stream);

            if (string.IsNullOrEmpty(qrText)) return BadRequest("QR is not recognized");

            var parsed = _totpAccountService.ParseOtpAuth(qrText);

            var account = new TotpAccount
            {
                UserId = userId,
                ServiceName = parsed.ServiceName,
                Issuer = parsed.Issuer,
                Secret = parsed.Secret,
                Digits = parsed.Digits,
                Period = parsed.Period
            };

            _context.TotpAccounts.Add(account);
            _context.SaveChanges();

            return Ok(account);
        }
        [HttpGet("getAccounts")]
        public IActionResult GetAccounts()
        {
            var userId = int.Parse(User.FindFirst("userId")?.Value ?? throw new UnauthorizedAccessException("User ID not found in token"));
            var accounts = _context.TotpAccounts.Where(a => a.UserId == userId).ToList();

            return Ok(accounts);
        }
        [HttpGet("codes")]
        public IActionResult GetCodes()
        {
            var userId = int.Parse(User.FindFirst("userId")?.Value ?? throw new UnauthorizedAccessException("User ID not found in token"));
            var accounts = _context.TotpAccounts.Where(a => a.UserId == userId).ToList();
            var result = accounts.Select(a => new
            {
                a.Id,
                a.ServiceName,
                a.Issuer,
                Code = _totpAccountService.GenerateCode(a),
            }).ToList();

            return Ok(result);
        }
    }
}
