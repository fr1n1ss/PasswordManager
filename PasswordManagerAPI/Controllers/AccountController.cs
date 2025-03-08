using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using PasswordManagerAPI.Models;
using PasswordManagerAPI.Services;

namespace PasswordManagerAPI.Controllers
{
    [Authorize]
    [Route("api/accounts")]
    [ApiController]
    public class AccountController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _config;
        private readonly IAccountService _accountService;
        public AccountController(AppDbContext context, IConfiguration config, IAccountService accountService)
        {
            _context = context;
            _config = config;
            _accountService = accountService;
        }

        #region POST
        [HttpPost("AddAccount")]
        public IActionResult AddAccountAsync([FromBody] AccountModel account)
        {

            if (string.IsNullOrEmpty(account.Login) || string.IsNullOrEmpty(account.ServiceName) || string.IsNullOrEmpty(account.Password))
                return BadRequest("Not all required fields are filled in");

            try
            {
                var userId = int.Parse(User.FindFirst("userId")?.Value ?? throw new UnauthorizedAccessException("User ID not found in token"));
                var newAccount = _accountService.AddAccount(userId, account.Login, account.ServiceName, account.Password, account.Description);

                return Ok(newAccount);
            }

            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPost("UpdateAccountAsync")]
        public async Task<IActionResult> UpdateAccountAsync(int accountId, string? newServiceName, string newPassword)
        {
            if (string.IsNullOrEmpty(newPassword))
                return BadRequest("Not all required fields are filled in");

            try
            {
                var userId = int.Parse(User.FindFirst("userId")?.Value ?? throw new UnauthorizedAccessException("User ID not found in token"));

                await _accountService.UpdateAccountAsync(userId, accountId, newServiceName, newPassword);

                return Ok();
            }

            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }

        }
        #endregion

        #region GET
        [HttpGet("GetAccounts")]

        public async Task<IActionResult> GetAccountsAsync()
        {
            try
            {

                var userId = int.Parse(User.FindFirst("userId")?.Value ?? throw new UnauthorizedAccessException("User ID not found in token"));

                var accounts = await _accountService.GetUserAccountsAsync(userId);

                return Ok(accounts);
            }
            catch(Exception e)
            {
                return BadRequest(e.Message);
            }

        }
        [HttpGet("GetAccountById")]
        public async Task<IActionResult> GetAccountByIdAsync(int accountId)
        {
            try
            {
                var userId = int.Parse(User.FindFirst("userId")?.Value ?? throw new UnauthorizedAccessException("User ID not found in token"));

                var account = await _accountService.GetAccountByIdAsync(userId, accountId);

                return Ok(account);
            }
            catch(Exception e)
            {
                return BadRequest(e.Message);
            }

        }
        #endregion

        #region DELETE
        [HttpDelete("DeleteAccount")]
        public async Task<IActionResult> DeleteAccountAsync(int accountId)
        {
            try
            {
                var userId = int.Parse(User.FindFirst("userId")?.Value ?? throw new UnauthorizedAccessException("User ID not found in token"));

                await _accountService.DeleteAccountAsync(userId, accountId);

                return Ok();
            }
            catch(Exception e)
            {
                return BadRequest(e.Message);
            }
        }
        #endregion

    }
}
