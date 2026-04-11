namespace PasswordManagerAPI.Services
{
    public static class RequestMetadataHelper
    {
        public static string? GetClientIp(HttpContext? httpContext)
        {
            if (httpContext == null)
            {
                return null;
            }

            var forwardedFor = httpContext.Request.Headers["X-Forwarded-For"].ToString();
            if (!string.IsNullOrWhiteSpace(forwardedFor))
            {
                return forwardedFor
                    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    .FirstOrDefault();
            }

            return httpContext.Connection.RemoteIpAddress?.ToString();
        }
    }
}
