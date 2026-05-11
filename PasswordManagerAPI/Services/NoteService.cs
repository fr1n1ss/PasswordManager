using Microsoft.EntityFrameworkCore;
using PasswordManagerAPI.Entities;

namespace PasswordManagerAPI.Services
{
    public class NoteService : INoteService
    {
        private readonly AppDbContext _context;

        public NoteService(AppDbContext context)
        {
            _context = context;
        }
        public Note AddNote(int userId, string title, string encryptedContent)
        {
            var user = _context.Users.FirstOrDefault(u => u.Id == userId);
            if (user == null)
                throw new ArgumentException("User with this userId not found");

            var note = new Note(userId, title, encryptedContent, DateTime.Now, DateTime.Now);

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

        public async Task<List<Note>> GetUserNotesAsync(int userId)
        {
            var notes = await _context.Notes.Where(n => n.UserID == userId).ToListAsync();
            if (notes.Count == 0)
                return new List<Note>();

            return notes;
        }

        public async Task UpdateNoteAsync(int userId, int noteId, string? newTitle, string? newContent)
        {
            var wasChanged = false;

            var note = await _context.Notes.FirstOrDefaultAsync(n => n.ID == noteId);
            if (note == null)
                throw new ArgumentException("Note with this noteId not found");

            if (!string.IsNullOrEmpty(newTitle))
            {
                note.Title = newTitle;
                wasChanged = true;
            }

            if (!string.IsNullOrEmpty(newContent))
            {
                note.EncryptedContent = newContent;
                wasChanged = true;
            }

            if (wasChanged)
            {
                note.UpdatedAt = DateTime.Now;
                _context.Notes.Update(note);
                await _context.SaveChangesAsync();
            }

        }

    }
}
