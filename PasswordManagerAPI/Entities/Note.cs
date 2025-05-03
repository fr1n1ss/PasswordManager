using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;

namespace PasswordManagerAPI.Entities
{
    [PrimaryKey(nameof(ID))]
    public class Note
    {
        public Note() { }
        public Note(int userID, string title, string encryptedContent, DateTime createdAt, DateTime updatedAt)
        {
            UserID = userID;
            Title = title;
            EncryptedContent = encryptedContent;
            CreatedAt = createdAt;
            UpdatedAt = updatedAt;
        }

        public int ID { get; set; }
        public int UserID { get; set; }
        [Required]
        [MaxLength(100)]
        public string Title { get; set; }
        [Required]
        public string EncryptedContent { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
}
