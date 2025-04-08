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
        private readonly IConfiguration _config;
        private readonly IAccountService _accountService;
        public AccountController(IConfiguration config, IAccountService accountService)
        {
            _config = config;
            _accountService = accountService;
        }

        #region POST
        [HttpPost("AddAccount")]
        public IActionResult AddAccount([FromBody] AccountModel account)
        {

            if (string.IsNullOrEmpty(account.Login) || string.IsNullOrEmpty(account.ServiceName) || string.IsNullOrEmpty(account.Password))
                return BadRequest("Not all required fields are filled in");

            try
            {
                var userId = int.Parse(User.FindFirst("userId")?.Value ?? throw new UnauthorizedAccessException("User ID not found in token"));
                var newAccount = _accountService.AddAccount(userId, account.Login, account.ServiceName, account.Password, account.URL, account.Description, account.MasterPassword);

                return Ok(newAccount);
            }

            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }
        #endregion

        #region PUT
        [HttpPut("UpdateAccount")]
        public async Task<IActionResult> UpdateAccountAsync(int accountId, string? newLogin, string? newServiceName, string? newPassword, string? newUrl, string? newDescription, string masterPassword)
        {
            if (string.IsNullOrEmpty(masterPassword))
                return BadRequest("Not all required fields are filled in");

            try
            {
                var userId = int.Parse(User.FindFirst("userId")?.Value ?? throw new UnauthorizedAccessException("User ID not found in token"));

                await _accountService.UpdateAccountAsync(userId, accountId, newLogin, newServiceName, newPassword, newUrl, newDescription, masterPassword);

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

        public async Task<IActionResult> GetAccountsAsync(string masterPassword)
        {
            try
            {

                var userId = int.Parse(User.FindFirst("userId")?.Value ?? throw new UnauthorizedAccessException("User ID not found in token"));

                var accounts = await _accountService.GetUserAccountsAsync(userId, masterPassword);

                return Ok(accounts);
            }
            catch(Exception e)
            {
                return BadRequest(e.Message);
            }

        }
        [HttpGet("GetAccountById")]
        public async Task<IActionResult> GetAccountByIdAsync(int accountId, string masterPassword)
        {
            try
            {
                var userId = int.Parse(User.FindFirst("userId")?.Value ?? throw new UnauthorizedAccessException("User ID not found in token"));

                var account = await _accountService.GetAccountByIdAsync(userId, accountId, masterPassword);

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
