namespace PasswordManagerAPI.Models
{
    public class VerifyTotpModel
    {
        public string TempToken { get; set; }
        public string Code { get; set; }
    }
}
