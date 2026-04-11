namespace PasswordManagerAPI.Models
{
    public class UserSessionModel
    {
        public Guid Id { get; set; }
        public string? UserAgent { get; set; }
        public string? IpAddress { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime LastSeenAt { get; set; }
        public DateTime ExpiresAt { get; set; }
        public bool IsCurrent { get; set; }
    }
}
