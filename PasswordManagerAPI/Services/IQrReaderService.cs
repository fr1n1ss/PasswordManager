namespace PasswordManagerAPI.Services
{
    public interface IQrReaderService
    {
        public string ReadQrCode(Stream stream);
    }
}
