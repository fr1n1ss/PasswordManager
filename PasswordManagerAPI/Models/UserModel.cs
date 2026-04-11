namespace PasswordManagerAPI.Models
{
    public class UserModel
    {
        public string Username { get; set; }
        public string Email { get; set; }
        public bool EmailConfirmed { get; set; }
        public string Salt { get; set; }
        public string? MasterPasswordVerifier { get; set; }
        public bool Is2FaEnabled { get; set; }
    }
}
