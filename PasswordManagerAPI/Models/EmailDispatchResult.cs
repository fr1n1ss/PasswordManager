namespace PasswordManagerAPI.Models
{
    public class EmailDispatchResult
    {
        public bool Delivered { get; set; }
        public string? PreviewCode { get; set; }
    }
}
