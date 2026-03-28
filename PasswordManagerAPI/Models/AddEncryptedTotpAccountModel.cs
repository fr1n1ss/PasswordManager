namespace PasswordManagerAPI.Models
{
    public class AddEncryptedTotpAccountModel
    {
        public string EncryptedPayload { get; set; } = string.Empty;
        public string Nonce { get; set; } = string.Empty;
        public int Version { get; set; } = 1;
    }
}
