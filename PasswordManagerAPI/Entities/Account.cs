using Microsoft.EntityFrameworkCore;

namespace PasswordManagerAPI.Entities
{
    [Index(nameof(UserID), nameof(ServiceName), nameof(Login), IsUnique = true)]
    [PrimaryKey(nameof(ID))]
    public class Account
    {
        public Account() { }
        public Account(string login, string serviceName, string password, string? description)
        {
            Login = login;
            ServiceName = serviceName;
            EncryptedPassword = password;
            Description = description;
        }
        public int ID { get; set; }
        public int UserID { get; set; }
        public string ServiceName { get; set; }
        public string Login {  get; set; }
        public string EncryptedPassword { get; set; }
        public string? Description { get; set; }
        public string Salt { get; set; }
        public DateTime CreationDate { get; set; }

    }
}