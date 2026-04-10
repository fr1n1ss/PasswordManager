using PasswordManagerAPI.Entities;

namespace PasswordManagerAPI.Services
{
    public interface INoteService
    {
        Note AddNote(int userId, string title, string encryptedContent);
        Task<List<Note>> GetUserNotesAsync(int userId);
        Task<Note> GetNoteByIdAsync(int userId, int noteId);
        Task UpdateNoteAsync(int userId, int noteId, string? newTitle, string? newContent);
        Task<string> GetHashAsync(int userId);
        Task DeleteNoteAsync(int userId, int noteId);

    }
}
