using Microsoft.EntityFrameworkCore;
using PasswordManagerAPI.Entities;
using PasswordManagerAPI.Models;
using RSAEncryptions;
using System.Numerics;

namespace PasswordManagerAPI.Services
{
    public class FavoriteService : IFavoriteService
    {
        private readonly AppDbContext _context;
        private readonly RSAEncryption _rsaEncryption;
        public FavoriteService(AppDbContext context, RSAEncryption rSA)
        {
            _context = context;
            _rsaEncryption = rSA;
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

        public async Task<FavoriteResult> GetUserFavoritesAsync(int userId, string masterPassword)
        {

            var favorites = await _context.Favorites.Where(f => f.UserId == userId).ToListAsync();

            var noteIds = favorites.Where(f => f.EntityType.ToLower() == "note").Select(f => f.EntityId).ToList();

            var accountIds = favorites.Where(f => f.EntityType.ToLower() == "account").Select(f => f.EntityId).ToList();

            var notes = new List<Note>();
            var accounts = new List<Account>();

            foreach (var noteId in noteIds)
            {
                var note = GetNoteByIdAsync(userId, noteId, masterPassword).Result;
                if (note != null)
                    notes.Add(note);              
            }
            
            foreach(var accountId in accountIds)
            {
                var account = GetAccountByIdAsync(userId, accountId, masterPassword).Result;
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

        private async Task<Account> GetAccountByIdAsync(int userId, int accountId, string masterPassword)
        {
            var account = await _context.Accounts.FirstOrDefaultAsync(a => a.ID == accountId && a.UserID == userId);

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);

            if (account == null)
                throw new ArgumentNullException("Account with this ID not found");

            if (user == null)
                throw new ArgumentNullException("User with this ID not found");

            UpdateRSA(user, masterPassword);

            account.EncryptedPassword = _rsaEncryption.DecryptText(account.EncryptedPassword);

            return account;
        }
        private async Task<Note> GetNoteByIdAsync(int userId, int noteId, string masterPassword)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null)
                throw new ArgumentException("User with this userId not found");

            var note = await _context.Notes.FirstOrDefaultAsync(n => n.ID == noteId && n.UserID == userId);
            if (note == null)
                throw new ArgumentException("Note with this noteId not found");

            UpdateRSA(user, masterPassword);

            note.EncryptedContent = _rsaEncryption.DecryptText(note.EncryptedContent);

            return note;
        }
        private void UpdateRSA(User user, string masterPassword)
        {
            var privateKey = RsaKeyManager.DecryptPrivateKey(user.EncryptedPrivateKey, masterPassword, user.Salt);
            _rsaEncryption.OverrideKeys(BigInteger.Parse(user.PublicKey), privateKey, BigInteger.Parse(user.Modulus));
        }
    }
}
