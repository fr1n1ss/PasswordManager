namespace PasswordManagerAPI.Services
{
    public interface IAuditService
    {
        Task LogAsync(string action, int? userId = null, Guid? sessionId = null, string? details = null);
    }
}
