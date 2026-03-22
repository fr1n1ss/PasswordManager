using System.ComponentModel.DataAnnotations;

namespace PasswordManagerAPI.Entities
{
    public class TotpAccount
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        [Required]
        public string ServiceName { get; set; }
        public string Issuer { get; set; }
        [Required]
        public string Secret { get; set; }
        public int Digits { get; set; } = 6;
        public int Period { get; set; } = 30;
    }
}
