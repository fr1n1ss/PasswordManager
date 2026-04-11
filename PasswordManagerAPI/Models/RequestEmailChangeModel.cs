namespace PasswordManagerAPI.Models
{
    public class RequestEmailChangeModel
    {
        public string NewEmail { get; set; } = string.Empty;
        public string CurrentPassword { get; set; } = string.Empty;
    }
}
