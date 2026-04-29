using System.Text.RegularExpressions;

namespace PasswordManagerAPI.Services
{
    public class PasswordPolicyService
    {
        public const int MinLength = 12;

        private static readonly Regex LowercaseRegex = new("[a-z]", RegexOptions.Compiled);
        private static readonly Regex UppercaseRegex = new("[A-Z]", RegexOptions.Compiled);
        private static readonly Regex DigitRegex = new("[0-9]", RegexOptions.Compiled);
        private static readonly Regex SpecialRegex = new("[^a-zA-Z0-9\\s]", RegexOptions.Compiled);

        private static readonly HashSet<string> CommonPasswords = new(StringComparer.OrdinalIgnoreCase)
        {
            "123456",
            "123456789",
            "12345678",
            "qwerty",
            "password",
            "password123",
            "admin",
            "admin123",
            "welcome",
            "welcome123",
            "letmein",
            "111111",
            "000000",
            "abc123",
            "iloveyou",
            "monkey",
            "dragon",
            "sunshine",
            "football",
            "master"
        };

        public PasswordPolicyValidationResult Validate(string? password)
        {
            var errors = new List<string>();

            if (string.IsNullOrWhiteSpace(password))
            {
                errors.Add("Пароль обязателен.");
                return new PasswordPolicyValidationResult(false, errors);
            }

            if (password.Length < MinLength)
            {
                errors.Add($"Пароль должен содержать не менее {MinLength} символов.");
            }

            if (!LowercaseRegex.IsMatch(password))
            {
                errors.Add("Пароль должен содержать хотя бы одну строчную букву.");
            }

            if (!UppercaseRegex.IsMatch(password))
            {
                errors.Add("Пароль должен содержать хотя бы одну заглавную букву.");
            }

            if (!DigitRegex.IsMatch(password))
            {
                errors.Add("Пароль должен содержать хотя бы одну цифру.");
            }

            if (!SpecialRegex.IsMatch(password))
            {
                errors.Add("Пароль должен содержать хотя бы один спецсимвол.");
            }

            if (password.Any(char.IsWhiteSpace))
            {
                errors.Add("Пароль не должен содержать пробелы.");
            }

            if (CommonPasswords.Contains(password))
            {
                errors.Add("Пароль слишком распространён.");
            }

            return new PasswordPolicyValidationResult(errors.Count == 0, errors);
        }
    }

    public sealed record PasswordPolicyValidationResult(bool IsValid, IReadOnlyList<string> Errors);
}
