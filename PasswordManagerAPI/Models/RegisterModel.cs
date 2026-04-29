using System.ComponentModel.DataAnnotations;

namespace PasswordManagerAPI.Models
{
    public class RegisterModel
    {
        public string Username { get; set; }

        [Required]
        public string Email { get; set; }

        [Required]
        public string Password { get; set; }

        [Required]
        public string Salt { get; set; }

        public string? MasterPasswordVerifier { get; set; }
    }
}
