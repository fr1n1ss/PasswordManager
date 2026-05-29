using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PasswordManagerAPI.Models;
using PasswordManagerAPI.Services;

namespace PasswordManagerAPI.Controllers
{
    [Authorize]
    [Route("api/notes")]
    [ApiController]
    public class NoteController : ControllerBase
    {
        private readonly IConfiguration _config;
        private readonly INoteService _noteService;
        public NoteController(IConfiguration config, INoteService noteService)
        {
            _config = config;
            _noteService = noteService;
        }

        #region POST
        [HttpPost("AddNote")]
        public IActionResult AddNote([FromBody] NoteModel note)
        {

            if (string.IsNullOrEmpty(note.Title) || string.IsNullOrEmpty(note.Content))
                return BadRequest("Заполнены не все обязательные поля");

            var validationError = ValidateNoteInput(note.Title, note.Content);
            if (validationError != null)
                return BadRequest(validationError);

            try
            {
                var userId = int.Parse(User.FindFirst("userId")?.Value ?? throw new UnauthorizedAccessException("User ID not found in token"));
                var newNote = _noteService.AddNote(userId, note.Title, note.Content);

                return Ok(newNote);
            }

            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }
        #endregion

        #region PUT
        [HttpPost("UpdateNoteAsync")]
        public async Task<IActionResult> UpdateNodeAsync([FromBody] UpdateNoteModel updatedNote)
        {
            try
            {
                var validationError = ValidateNoteInput(updatedNote.NewTitle, updatedNote.NewContent);
                if (validationError != null)
                    return BadRequest(validationError);

                var userId = int.Parse(User.FindFirst("userId")?.Value ?? throw new UnauthorizedAccessException("User ID not found in token"));

                await _noteService.UpdateNoteAsync(userId, updatedNote.ID, updatedNote.NewTitle, updatedNote.NewContent);

                return Ok();
            }

            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }

        }
        #endregion

        #region GET
        [HttpGet("GetNotesAsync")]

        public async Task<IActionResult> GetNotesAsync()
        {
            try
            {

                var userId = int.Parse(User.FindFirst("userId")?.Value ?? throw new UnauthorizedAccessException("User ID not found in token"));

                var notes = await _noteService.GetUserNotesAsync(userId);

                return Ok(notes);
            }
            catch (Exception e)
            {
                return BadRequest(e.Message);
            }

        }
        #endregion

        #region DELETE
        [HttpDelete("DeleteNoteAsync")]
        public async Task<IActionResult> DeleteNoteAsync(int noteId)
        {
            try
            {
                var userId = int.Parse(User.FindFirst("userId")?.Value ?? throw new UnauthorizedAccessException("User ID not found in token"));

                await _noteService.DeleteNoteAsync(userId, noteId);

                return Ok();
            }
            catch (Exception e)
            {
                return BadRequest(e.Message);
            }
        }
        #endregion

        private static string? ValidateNoteInput(string? title, string? content)
        {
            if (UserInputLimits.IsTooLong(title, UserInputLimits.NoteTitleMaxLength))
                return $"Заголовок заметки должен быть не длиннее {UserInputLimits.NoteTitleMaxLength} символов";

            if (UserInputLimits.IsTooLong(content, UserInputLimits.NoteContentPayloadMaxLength))
                return $"Содержимое заметки слишком длинное";

            return null;
        }
    }
}
