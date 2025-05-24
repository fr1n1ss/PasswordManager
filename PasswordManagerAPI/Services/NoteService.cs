using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using PasswordManagerAPI.Entities;
using RSAEncryptions;
using System.Numerics;
using System.Security.Cryptography;
using System.Text;

namespace PasswordManagerAPI.Services
{
    public class NoteService : INoteService
    {
        private readonly AppDbContext _context;
        private RSAEncryption _rsaEncryption;

        public NoteService(AppDbContext context, RSAEncryption rsaEncryption)
        {
            _context = context;
            _rsaEncryption = rsaEncryption;
        }
        public Note AddNote(int userId, string title, string content, string masterPassword)
        {
            var user = _context.Users.FirstOrDefault(u => u.Id == userId);
            if (user == null)
                throw new ArgumentException("User with this userId not found");

            UpdateRSA(user, masterPassword);

            var encryptedNote = _rsaEncryption.EncryptText(content);

            var note = new Note(userId, title, encryptedNote, DateTime.Now, DateTime.Now);

            _context.Notes.Add(note);

            _context.SaveChanges();

            return note;
        }

        public async Task DeleteNoteAsync(int userId, int noteId)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null)
                throw new ArgumentException("User with this userId not found");

            var note = await _context.Notes.FirstOrDefaultAsync(n => n.ID == noteId && n.UserID == userId);
            if(note == null)
                throw new ArgumentException("Note with this noteId not found");

            var favorite = await _context.Favorites.FirstOrDefaultAsync(f => f.UserId == userId && f.EntityType == "note" && f.EntityId == note.ID);
            if (favorite != null)
                _context.Favorites.Remove(favorite);

            _context.Notes.Remove(note);

            await _context.SaveChangesAsync();
        }

        public async Task<Note> GetNoteByIdAsync(int userId, int noteId, string masterPassword)
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

        public async Task<List<Note>> GetUserNotesAsync(int userId, string masterPassword)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null)
                throw new ArgumentException("User with this userId not found");

            var notes = await _context.Notes.Where(n => n.UserID == userId).ToListAsync();
            if (notes.Count == 0)
                return new List<Note>();

            UpdateRSA(user, masterPassword);

            foreach (var note in notes)
                note.EncryptedContent = _rsaEncryption.DecryptText(note.EncryptedContent);

            return notes;
        }

        public async Task UpdateNoteAsync(int userId, int noteId, string? newTitle, string? newContent, string masterPassword)
        {
            var wasChanged = false;

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null)
                throw new ArgumentException("User with this userId not found");

            var note = await _context.Notes.FirstOrDefaultAsync(n => n.ID == noteId);
            if (note == null)
                throw new ArgumentException("Note with this noteId not found");

            UpdateRSA(user, masterPassword);

            if (!string.IsNullOrEmpty(newTitle))
            {
                note.Title = newTitle;
                wasChanged = true;
            }

            if (!string.IsNullOrEmpty(newContent))
            {
                note.EncryptedContent = _rsaEncryption.EncryptText(newContent);
                wasChanged = true;
            }

            if (wasChanged)
            {
                note.UpdatedAt = DateTime.Now;
                _context.Notes.Update(note);
                await _context.SaveChangesAsync();
            }

        }

        public async Task<string> GetHashAsync(int userId)
        {
            var notes = await _context.Notes.Where(n => n.UserID == userId).ToListAsync();

            string notesJson = JsonConvert.SerializeObject(notes);

            using var sha256 = SHA256.Create();
            var notesHash = Convert.ToHexString(sha256.ComputeHash(Encoding.UTF8.GetBytes(notesJson)));

            return notesHash = notesHash.ToLower();

        }


        private void UpdateRSA(User user, string masterPassword)
        {
            var privateKey = RsaKeyManager.DecryptPrivateKey(user.EncryptedPrivateKey, masterPassword, user.Salt);
            _rsaEncryption.OverrideKeys(BigInteger.Parse(user.PublicKey), privateKey, BigInteger.Parse(user.Modulus));
        }
    }
}
