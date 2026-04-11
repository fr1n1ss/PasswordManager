using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;

namespace PasswordManagerAPI.Entities
{
    [PrimaryKey(nameof(Id))]
    [Index(nameof(UserId), nameof(CreatedAt))]
    public class AuditLog
    {
        public long Id { get; set; }
        public int? UserId { get; set; }
        public Guid? SessionId { get; set; }
        [Required]
        [MaxLength(100)]
        public string Action { get; set; } = string.Empty;
        [MaxLength(2000)]
        public string? Details { get; set; }
        [MaxLength(128)]
        public string? IpAddress { get; set; }
        [MaxLength(512)]
        public string? UserAgent { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
