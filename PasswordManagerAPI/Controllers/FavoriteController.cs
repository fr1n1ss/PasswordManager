using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PasswordManagerAPI.Entities;
using PasswordManagerAPI.Models;
using PasswordManagerAPI.Services;

namespace PasswordManagerAPI.Controllers
{
    [Authorize]
    [Route("api/favorite")]
    [ApiController]
    public class FavoriteController : ControllerBase
    {
        private readonly IConfiguration _config;
        private readonly IFavoriteService _favoriteService;
        public FavoriteController(IConfiguration config, IFavoriteService favoriteService)
        {
            _config = config;
            _favoriteService = favoriteService;
        }

        #region POST
        [HttpPost("AddToFavoritesAsync")]
        public async Task<IActionResult> AddToFavoritesAsync(string entityType, int entityId)
        {

            if (string.IsNullOrEmpty(entityType))
                return BadRequest("Not all required fields are filled in");

            try
            {
                var userId = int.Parse(User.FindFirst("userId")?.Value ?? throw new UnauthorizedAccessException("User ID not found in token"));
                var newFavorite = await _favoriteService.AddToFavoritesAsync(userId, entityType, entityId);

                return Ok(newFavorite);
            }

            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }
        #endregion

        #region PUT

        [HttpPut("IsFavoriteAsync")]

        public async Task<IActionResult> IsFavoriteAsync(string entityType, int entityId)
        {
            try
            {

                var userId = int.Parse(User.FindFirst("userId")?.Value ?? throw new UnauthorizedAccessException("User ID not found in token"));

                return Ok(await _favoriteService.IsFavoriteAsync(userId, entityType, entityId));
            }
            catch (Exception e)
            {
                return BadRequest(e.Message);
            }

        }

        #endregion

        #region GET
        [HttpGet("GetUserFavoritesAsync")]

        public async Task<IActionResult> GetUserFavoritesAsync(string masterPassword)
        {
            try
            {

                var userId = int.Parse(User.FindFirst("userId")?.Value ?? throw new UnauthorizedAccessException("User ID not found in token"));

                var favorites = await _favoriteService.GetUserFavoritesAsync(userId);

                return Ok(favorites);
            }
            catch (Exception e)
            {
                return BadRequest(e.Message);
            }

        }
        #endregion

        #region DELETE
        [HttpDelete("RemoveFromFavoritesAsync")]
        public async Task<IActionResult> RemoveFromFavoritesAsync(string entityType, int entityId)
        {
            try
            {
                var userId = int.Parse(User.FindFirst("userId")?.Value ?? throw new UnauthorizedAccessException("User ID not found in token"));

                await _favoriteService.RemoveFromFavoritesAsync(userId, entityType, entityId);

                return Ok();
            }
            catch (Exception e)
            {
                return BadRequest(e.Message);
            }
        }
        #endregion
    }
}
