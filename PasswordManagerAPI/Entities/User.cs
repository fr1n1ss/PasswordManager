using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;

namespace PasswordManagerAPI.Entities
{
    [PrimaryKey(nameof(Id))]
    [Index(nameof(Username), IsUnique = true)]
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
        [Required] //Запрет на пустые значения
        [MaxLength(25)]
        public string Username { get; set; }
        [Required]
        public string Email { get; set; }
        [Required]
        public string PasswordHash { get; set; }
        [Required]
        public string Salt { get; set; }
    }
}
