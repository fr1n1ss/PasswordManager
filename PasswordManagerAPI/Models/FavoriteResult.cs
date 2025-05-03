using PasswordManagerAPI.Entities;

namespace PasswordManagerAPI.Models
{
    public class FavoriteResult
    {
        public List<Note> Notes { get; set; }
        public List<Account> Accounts { get; set; }
    }
}
