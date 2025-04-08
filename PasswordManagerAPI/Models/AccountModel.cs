namespace PasswordManagerAPI.Models
{
    public class AccountModel
    {
        public string Login { get; set; }
        public string Password { get; set; }
        public string ServiceName { get; set; }
        public string URL { get; set; }
        public string? Description { get; set; }
        public string MasterPassword { get; set; }

    }
}
