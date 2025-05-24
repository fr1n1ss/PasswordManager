using PasswordManagerAPI.Entities;

namespace PasswordManagerAPI.Services
{
    public interface INoteService
    {
        Note AddNote(int userId, string title, string content, string masterPassword);
        Task<List<Note>> GetUserNotesAsync(int userId, string masterPassword);
        Task<Note> GetNoteByIdAsync(int userId, int noteId, string masterPassword);
        Task UpdateNoteAsync(int userId, int noteId, string? newTitle, string? newContent, string masterPassword);
        Task<string> GetHashAsync(int userId);
        Task DeleteNoteAsync(int userId, int noteId);

    }
}
