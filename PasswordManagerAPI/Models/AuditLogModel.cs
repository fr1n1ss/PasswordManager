namespace PasswordManagerAPI.Models
{
    public class AuditLogModel
    {
        public long Id { get; set; }
        public string Action { get; set; } = string.Empty;
        public string? Details { get; set; }
        public DateTime CreatedAt { get; set; }
        public string? IpAddress { get; set; }
        public string? UserAgent { get; set; }
    }
}
