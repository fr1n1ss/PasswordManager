using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
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
                return BadRequest("Not all required fields are filled in");

            try
            {
                var userId = int.Parse(User.FindFirst("userId")?.Value ?? throw new UnauthorizedAccessException("User ID not found in token"));
                var newNote = _noteService.AddNote(userId, note.Title, note.Content, note.MasterPassword);

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
            if (string.IsNullOrEmpty(updatedNote.MasterPassword))
                return BadRequest("Not all required fields are filled in");

            try
            {
                var userId = int.Parse(User.FindFirst("userId")?.Value ?? throw new UnauthorizedAccessException("User ID not found in token"));

                await _noteService.UpdateNoteAsync(userId, updatedNote.ID, updatedNote.NewTitle, updatedNote.NewContent, updatedNote.MasterPassword);

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

        public async Task<IActionResult> GetNotesAsync(string masterPassword)
        {
            try
            {

                var userId = int.Parse(User.FindFirst("userId")?.Value ?? throw new UnauthorizedAccessException("User ID not found in token"));

                var notes = await _noteService.GetUserNotesAsync(userId, masterPassword);

                return Ok(notes);
            }
            catch (Exception e)
            {
                return BadRequest(e.Message);
            }

        }
        [HttpGet("GetNoteByIdAsync")]
        public async Task<IActionResult> GetNoteByIdAsync(int noteId, string masterPassword)
        {
            try
            {
                var userId = int.Parse(User.FindFirst("userId")?.Value ?? throw new UnauthorizedAccessException("User ID not found in token"));

                var note = await _noteService.GetNoteByIdAsync(userId, noteId, masterPassword);

                return Ok(note);
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



    }
}
