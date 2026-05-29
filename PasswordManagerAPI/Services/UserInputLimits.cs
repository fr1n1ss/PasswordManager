namespace PasswordManagerAPI.Services
{
    public static class UserInputLimits
    {
        public const int UsernameMaxLength = 25;
        public const int EmailMaxLength = 256;
        public const int AuthPasswordMaxLength = 128;
        public const int MasterPasswordVerifierMaxLength = 512;
        public const int AccountServiceNameMaxLength = 450;
        public const int AccountLoginMaxLength = 450;
        public const int AccountPasswordPayloadMaxLength = 4096;
        public const int AccountUrlMaxLength = 2048;
        public const int AccountDescriptionMaxLength = 1000;
        public const int NoteTitleMaxLength = 100;
        public const int NoteContentPayloadMaxLength = 12000;

        public static bool IsTooLong(string? value, int maxLength)
        {
            return value != null && value.Length > maxLength;
        }
    }
}
