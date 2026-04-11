using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;

namespace PasswordManagerAPI.Entities
{
    [PrimaryKey(nameof(Id))]
    [Index(nameof(UserId), nameof(JwtId), IsUnique = true)]
    public class UserSession
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public int UserId { get; set; }
        [Required]
        [MaxLength(64)]
        public string JwtId { get; set; } = string.Empty;
        [MaxLength(512)]
        public string? UserAgent { get; set; }
        [MaxLength(128)]
        public string? IpAddress { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime LastSeenAt { get; set; } = DateTime.UtcNow;
        public DateTime ExpiresAt { get; set; }
        public DateTime? RevokedAt { get; set; }
        [MaxLength(128)]
        public string? RevokedReason { get; set; }
    }
}
