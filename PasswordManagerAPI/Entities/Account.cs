namespace PasswordManagerAPI.Entities
{
    public class Account
    {
        public Account() { }
        public Account(string login, string password, string? description)
        {
            Login = login;
            EncryptedPassword = password;
            Description = description;
        }
        public int Id { get; set; }
        public string Login {  get; set; }
        public string EncryptedPassword { get; set; }
        public string? Description { get; set; }
        public string Salt { get; set; }
        public string UserID { get; set; }

    }
}
