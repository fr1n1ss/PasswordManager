using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using PasswordManagerAPI.Entities;
using PasswordManagerAPI.Models;
using System.Security.Cryptography;
using System.Text;

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
            var noteIds = favorites.Where(f => f.EntityType.ToLower() == "note").Select(f => f.EntityId).ToList();
            var accountIds = favorites.Where(f => f.EntityType.ToLower() == "account").Select(f => f.EntityId).ToList();

            var notes = new List<Note>();
            var accounts = new List<Account>();

            foreach (var noteId in noteIds)
            {
                var note = await GetNoteByIdAsync(userId, noteId);
                if (note != null)
                    notes.Add(note);
            }

            foreach (var accountId in accountIds)
            {
                var account = await GetAccountByIdAsync(userId, accountId);
                if (account != null)
                    accounts.Add(account);
            }

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

        public async Task<string> GetHashAsync(int userId)
        {
            var favorites = await _context.Favorites.Where(n => n.UserId == userId).ToListAsync();
            string favoritesJson = JsonConvert.SerializeObject(favorites);

            using var sha256 = SHA256.Create();
            var favoritesHash = Convert.ToHexString(sha256.ComputeHash(Encoding.UTF8.GetBytes(favoritesJson)));
            return favoritesHash.ToLower();
        }

        private async Task<Account> GetAccountByIdAsync(int userId, int accountId)
        {
            var account = await _context.Accounts.FirstOrDefaultAsync(a => a.ID == accountId && a.UserID == userId);

            if (account == null)
                throw new ArgumentNullException("Account with this ID not found");
            return account;
        }

        private async Task<Note> GetNoteByIdAsync(int userId, int noteId)
        {
            var note = await _context.Notes.FirstOrDefaultAsync(n => n.ID == noteId && n.UserID == userId);
            if (note == null)
                throw new ArgumentException("Note with this noteId not found");
            return note;
        }
    }
}
