namespace PasswordManagerAPI.Models
{
    public class UpdateNoteModel
    {
        public int ID { get; set; }

        public string? NewTitle { get; set; }

        public string? NewContent { get; set; }
        public string MasterPassword { get; set; }

    }
}
