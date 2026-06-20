using System.Security.Cryptography;
using Microsoft.IdentityModel.Tokens;

namespace PasswordManagerAPI.Services
{
    public sealed class JwtKeyProvider
    {
        public JwtKeyProvider(IConfiguration configuration)
        {
            var privateKeyPem = ReadPem(configuration, "Jwt:PrivateKeyPem", "Jwt:PrivateKeyPath", required: true);
            var publicKeyPem = ReadPem(configuration, "Jwt:PublicKeyPem", "Jwt:PublicKeyPath", required: false);

            var signingRsa = RSA.Create();
            signingRsa.ImportFromPem(privateKeyPem);
            SigningKey = new RsaSecurityKey(signingRsa)
            {
                KeyId = configuration["Jwt:KeyId"] ?? "passwordmanager-rsa"
            };

            RSA validationRsa;
            if (string.IsNullOrWhiteSpace(publicKeyPem))
            {
                validationRsa = RSA.Create();
                validationRsa.ImportParameters(signingRsa.ExportParameters(false));
            }
            else
            {
                validationRsa = RSA.Create();
                validationRsa.ImportFromPem(publicKeyPem);
            }

            ValidationKey = new RsaSecurityKey(validationRsa)
            {
                KeyId = SigningKey.KeyId
            };
        }

        public RsaSecurityKey SigningKey { get; }

        public RsaSecurityKey ValidationKey { get; }

        public SigningCredentials CreateSigningCredentials()
        {
            return new SigningCredentials(SigningKey, SecurityAlgorithms.RsaSha256);
        }

        private static string ReadPem(IConfiguration configuration, string valueKey, string pathKey, bool required)
        {
            var value = configuration[valueKey];
            if (!string.IsNullOrWhiteSpace(value))
            {
                return NormalizePem(value);
            }

            var path = configuration[pathKey];
            if (!string.IsNullOrWhiteSpace(path))
            {
                return File.ReadAllText(path);
            }

            if (required)
            {
                throw new InvalidOperationException(
                    $"JWT private signing key is required. Configure {valueKey} or {pathKey} with an RSA PEM key.");
            }

            return string.Empty;
        }

        private static string NormalizePem(string value)
        {
            var normalized = value.Replace("\\n", "\n", StringComparison.Ordinal);
            if (normalized.Contains("-----BEGIN", StringComparison.Ordinal))
            {
                return normalized;
            }

            try
            {
                return System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(normalized));
            }
            catch (FormatException)
            {
                return normalized;
            }
        }
    }
}
