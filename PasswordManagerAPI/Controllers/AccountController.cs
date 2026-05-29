using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
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
                return BadRequest("Заполнены не все обязательные поля");

            var validationError = ValidateAccountInput(account.Login, account.ServiceName, account.Password, account.URL, account.Description);
            if (validationError != null)
                return BadRequest(validationError);

            try
            {
                var userId = int.Parse(User.FindFirst("userId")?.Value ?? throw new UnauthorizedAccessException("User ID not found in token"));
                var newAccount = _accountService.AddAccount(userId, account.Login, account.ServiceName, account.Password, account.URL, account.Description);

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
            try
            {
                var validationError = ValidateAccountInput(updatedAccount.NewLogin, updatedAccount.NewServiceName, updatedAccount.NewPassword, updatedAccount.NewURL, updatedAccount.NewDescription);
                if (validationError != null)
                    return BadRequest(validationError);

                var userId = int.Parse(User.FindFirst("userId")?.Value ?? throw new UnauthorizedAccessException("User ID not found in token"));

                await _accountService.UpdateAccountAsync(userId, updatedAccount.ID, updatedAccount.NewLogin, updatedAccount.NewServiceName, updatedAccount.NewPassword, updatedAccount.NewURL, updatedAccount.NewDescription);

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

        private static string? ValidateAccountInput(string? login, string? serviceName, string? password, string? url, string? description)
        {
            if (UserInputLimits.IsTooLong(serviceName, UserInputLimits.AccountServiceNameMaxLength))
                return $"Название сервиса должно быть не длиннее {UserInputLimits.AccountServiceNameMaxLength} символов";

            if (UserInputLimits.IsTooLong(login, UserInputLimits.AccountLoginMaxLength))
                return $"Логин должен быть не длиннее {UserInputLimits.AccountLoginMaxLength} символов";

            if (UserInputLimits.IsTooLong(password, UserInputLimits.AccountPasswordPayloadMaxLength))
                return $"Пароль слишком длинный";

            if (UserInputLimits.IsTooLong(url, UserInputLimits.AccountUrlMaxLength))
                return $"URL должен быть не длиннее {UserInputLimits.AccountUrlMaxLength} символов";

            if (UserInputLimits.IsTooLong(description, UserInputLimits.AccountDescriptionMaxLength))
                return $"Описание должно быть не длиннее {UserInputLimits.AccountDescriptionMaxLength} символов";

            return null;
        }
    }
}
