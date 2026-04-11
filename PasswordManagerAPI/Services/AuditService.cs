using PasswordManagerAPI.Entities;

namespace PasswordManagerAPI.Services
{
    public class AuditService : IAuditService
    {
        private readonly AppDbContext _context;
        private readonly IHttpContextAccessor _httpContextAccessor;

        public AuditService(AppDbContext context, IHttpContextAccessor httpContextAccessor)
        {
            _context = context;
            _httpContextAccessor = httpContextAccessor;
        }

        public async Task LogAsync(string action, int? userId = null, Guid? sessionId = null, string? details = null)
        {
            var httpContext = _httpContextAccessor.HttpContext;
            var ipAddress = RequestMetadataHelper.GetClientIp(httpContext);
            var userAgent = httpContext?.Request.Headers.UserAgent.ToString();

            _context.AuditLogs.Add(new AuditLog
            {
                UserId = userId,
                SessionId = sessionId,
                Action = action,
                Details = details,
                IpAddress = ipAddress,
                UserAgent = userAgent,
                CreatedAt = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();
        }
    }
}
