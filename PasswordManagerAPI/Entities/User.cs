using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;

namespace PasswordManagerAPI.Entities
{
    [PrimaryKey(nameof(Id))]
    [Index(nameof(Username), IsUnique = true)]
    [Index(nameof(Email), IsUnique = true)]
    public class User
    {
        public User() { }
        public User(string username) 
        { 
            Username = username; 
        }
        public User(string username, string email, string passwordHash, string salt)
        {
            Username = username;
            Email = email;
            PasswordHash = passwordHash;
            Salt = salt;
        }

        public int Id { get; set; }
        [Required]
        public string Username { get; set; }
        [Required]
        [MaxLength(450)]
        public string Email { get; set; }
        public bool EmailConfirmed { get; set; }
        [Required]
        public string PasswordHash { get; set; }
        [Required]
        public string Salt { get; set; }
        public string? MasterPasswordVerifier { get; set; }
        public string? TotpSecret { get; set; }
        public bool Is2FaEnabled { get; set; }
    }
}
