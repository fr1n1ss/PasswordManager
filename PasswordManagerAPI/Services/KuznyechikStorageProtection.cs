using System.Security.Cryptography;
using System.Text;
using KuznyechikLib;

namespace PasswordManagerAPI.Services
{
    public static class KuznyechikStorageProtection
    {
        private const int BlockSize = Transformations.BLOCK_SIZE;
        private const string EnvelopePrefix = "KUZ1:";
        private const string PlaintextPrefix = "PMK1|";

        public static bool IsProtectedPayload(string value)
        {
            return value.StartsWith(EnvelopePrefix, StringComparison.Ordinal);
        }

        public static string Encrypt(string plainText, string masterPassword, string salt)
        {
            byte[] nonce = RandomNumberGenerator.GetBytes(BlockSize);
            byte[] key = DeriveKey(masterPassword, salt);
            byte[] payload = Encoding.UTF8.GetBytes($"{PlaintextPrefix}{plainText}");
            byte[] encrypted = TransformCtr(payload, key, nonce);

            return $"{EnvelopePrefix}{Convert.ToBase64String(nonce)}:{Convert.ToBase64String(encrypted)}";
        }

        public static string Decrypt(string protectedPayload, string masterPassword, string salt)
        {
            string[] parts = protectedPayload.Split(':', 3);
            if (parts.Length != 3 || parts[0] != EnvelopePrefix.TrimEnd(':'))
            {
                throw new ArgumentException("Invalid Kuznyechik payload format");
            }

            byte[] nonce = Convert.FromBase64String(parts[1]);
            byte[] encrypted = Convert.FromBase64String(parts[2]);
            byte[] key = DeriveKey(masterPassword, salt);
            byte[] decrypted = TransformCtr(encrypted, key, nonce);

            string text;
            try
            {
                text = new UTF8Encoding(false, true).GetString(decrypted);
            }
            catch (DecoderFallbackException)
            {
                throw new ArgumentException("Invalid master password or corrupted Kuznyechik payload");
            }

            if (!text.StartsWith(PlaintextPrefix, StringComparison.Ordinal))
            {
                throw new ArgumentException("Invalid master password or corrupted Kuznyechik payload");
            }

            return text[PlaintextPrefix.Length..];
        }

        private static byte[] DeriveKey(string masterPassword, string salt)
        {
            byte[] saltBytes = Convert.FromBase64String(salt);
            using var pbkdf2 = new Rfc2898DeriveBytes(masterPassword, saltBytes, 100_000, HashAlgorithmName.SHA256);
            return pbkdf2.GetBytes(32);
        }

        private static byte[] TransformCtr(byte[] payload, byte[] key, byte[] nonce)
        {
            var cipher = new Kuznyechik(key);
            byte[] result = new byte[payload.Length];
            byte[] counter = (byte[])nonce.Clone();

            for (int offset = 0; offset < payload.Length; offset += BlockSize)
            {
                Span<byte> gamma = stackalloc byte[BlockSize];
                cipher.EncryptBlock(counter, gamma);

                int chunkLength = Math.Min(BlockSize, payload.Length - offset);
                for (int index = 0; index < chunkLength; index++)
                {
                    result[offset + index] = (byte)(payload[offset + index] ^ gamma[index]);
                }

                IncrementCounter(counter);
            }

            return result;
        }

        private static void IncrementCounter(byte[] counter)
        {
            for (int index = counter.Length - 1; index >= 0; index--)
            {
                counter[index]++;
                if (counter[index] != 0)
                {
                    break;
                }
            }
        }
    }
}
