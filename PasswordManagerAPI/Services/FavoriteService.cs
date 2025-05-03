using Microsoft.EntityFrameworkCore;
using PasswordManagerAPI.Entities;
using PasswordManagerAPI.Models;
using RSAEncryptions;

namespace PasswordManagerAPI.Services
{
    public class FavoriteService : IFavoriteService
    {
        private readonly AppDbContext _context;
        public FavoriteService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<Favorite> AddToFavoritesAsync(int userId, string entityType, int entityId)
        {
            var exists = await IsFavoriteAsync(userId, entityType, entityId);

            if (exists)
                throw new ArgumentException("Already favorite");

            var favorite = new Favorite
            {
                UserId = userId,
                EntityId = entityId,
                EntityType = entityType
            };

            _context.Favorites.Add(favorite);
            await _context.SaveChangesAsync();
            return favorite;
        }

        public async Task<FavoriteResult> GetUserFavoritesAsync(int userId)
        {

            var favorites = await _context.Favorites.Where(f => f.UserId == userId).ToListAsync();

            var noteIds = favorites.Where(f => f.EntityType == "Note").Select(f => f.EntityId).ToList();

            var accountIds = favorites.Where(f => f.EntityType == "Account").Select(f => f.EntityId).ToList();

            var notes = await _context.Notes.Where(n => noteIds.Contains(n.ID)).ToListAsync();

            var accounts = await _context.Accounts.Where(a => accountIds.Contains(a.ID)).ToListAsync();

            return new FavoriteResult
            {
                Notes = notes,
                Accounts = accounts
            };
        }

        public async Task<bool> IsFavoriteAsync(int userId, string entityType, int entityId)
        {
            return await _context.Favorites.AnyAsync(f => f.UserId == userId && f.EntityType == entityType && f.EntityId == entityId);
        }

        public async Task RemoveFromFavoritesAsync(int userId, string entityType, int entityId)
        {
            var favorite = await _context.Favorites.FirstOrDefaultAsync(f => f.UserId == userId && f.EntityType == entityType && f.EntityId == entityId);

            if (favorite != null)
            {
                _context.Favorites.Remove(favorite);
                await _context.SaveChangesAsync();
            }
        }
    }
}
