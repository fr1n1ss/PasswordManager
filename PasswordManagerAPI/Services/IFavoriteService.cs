using PasswordManagerAPI.Entities;
using PasswordManagerAPI.Models;

namespace PasswordManagerAPI.Services
{
    public interface IFavoriteService
    {
        public Task<bool> IsFavoriteAsync(int userId, string entityType, int entityId);
        public Task<Favorite> AddToFavoritesAsync(int userId, string entityType, int entityId);
        public Task RemoveFromFavoritesAsync(int userId, string entityType, int entityId);
        public Task<FavoriteResult> GetUserFavoritesAsync(int userId);
    }
}
