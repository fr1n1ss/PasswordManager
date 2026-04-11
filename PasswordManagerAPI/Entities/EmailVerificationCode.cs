using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;

namespace PasswordManagerAPI.Entities
{
    [PrimaryKey(nameof(Id))]
    [Index(nameof(UserId), nameof(Purpose))]
    public class EmailVerificationCode
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public int UserId { get; set; }
        [Required]
        [MaxLength(32)]
        public string Purpose { get; set; } = string.Empty;
        [Required]
        [MaxLength(256)]
        public string TargetEmail { get; set; } = string.Empty;
        [Required]
        [MaxLength(128)]
        public string CodeHash { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime ExpiresAt { get; set; }
        public DateTime? ConsumedAt { get; set; }
    }
}
