namespace PasswordManagerAPI.Models
{
    public class RotateMasterPasswordModel
    {
        public List<RotatedAccountCipherModel> Accounts { get; set; } = new();
        public List<RotatedNoteCipherModel> Notes { get; set; } = new();
        public List<RotatedTotpCipherModel> TotpAccounts { get; set; } = new();
        public string? MasterPasswordVerifier { get; set; }
        public bool ClearServerVerifier { get; set; } = true;
    }

    public class RotatedAccountCipherModel
    {
        public int Id { get; set; }
        public string EncryptedPassword { get; set; } = string.Empty;
    }

    public class RotatedNoteCipherModel
    {
        public int Id { get; set; }
        public string EncryptedContent { get; set; } = string.Empty;
    }

    public class RotatedTotpCipherModel
    {
        public int Id { get; set; }
        public string EncryptedPayload { get; set; } = string.Empty;
        public string Nonce { get; set; } = string.Empty;
        public int Version { get; set; } = 1;
    }
}
