using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Identity.Client;
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

        [HttpPost("UpdateAccount")]
        public async Task<IActionResult> UpdateAccountAsync([FromBody] UpdateAccountModel updatedAccount)
        {
            if (string.IsNullOrEmpty(updatedAccount.MasterPassword))
                return BadRequest("Not all required fields are filled in");

            try
            {
                var userId = int.Parse(User.FindFirst("userId")?.Value ?? throw new UnauthorizedAccessException("User ID not found in token"));

                await _accountService.UpdateAccountAsync(userId, updatedAccount.ID, updatedAccount.NewLogin, updatedAccount.NewServiceName, updatedAccount.NewPassword, updatedAccount.NewURL, updatedAccount.NewDescription, updatedAccount.MasterPassword);

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
