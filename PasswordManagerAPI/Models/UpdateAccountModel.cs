namespace PasswordManagerAPI.Models
{
    public class UpdateAccountModel
    {
        public int ID { get; set; }
        public string? NewLogin { get; set; }
        public string? NewPassword { get; set; }
        public string? NewServiceName { get; set; }
        public string? NewURL { get; set; }
        public string? NewDescription { get; set; }
        public string MasterPassword { get; set; }
    }
}
