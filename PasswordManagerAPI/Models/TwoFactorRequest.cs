namespace PasswordManagerAPI.Models
{
    public class TwoFactorRequest
    {
        public string TempToken { get; set; }
        public string Code { get; set; }
    }
}
