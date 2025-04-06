using System.Numerics;
using System.Security.Cryptography;
using System.Text;

namespace RSAEncryptions
{
    public class RsaKeyManager
    {
        private readonly string _masterPassword;

        public RsaKeyManager(string masterPassword)
        {
            _masterPassword = masterPassword;
        }

        public RSAEncryption CreateNewKeyPair(out string encryptedPrivateKey, string saltBase64)
        {
            var rsa = new RSAEncryption();
            encryptedPrivateKey = EncryptPrivateKey(rsa.PrivateKey, _masterPassword, saltBase64);
            return rsa;
        }

        public RSAEncryption LoadFromStorage(string encryptedPrivateKey, string publicKey, string modulus, string saltBase64)
        {
            BigInteger privKey = DecryptPrivateKey(encryptedPrivateKey, _masterPassword, saltBase64);
            BigInteger pubKey = BigInteger.Parse(publicKey);
            BigInteger mod = BigInteger.Parse(modulus);

            var rsa = new RSAEncryption();
            rsa.OverrideKeys(pubKey, privKey, mod);
            return rsa;
        }

        private static byte[] DeriveAesKey(string masterPassword, string saltBase64)
        {
            byte[] salt = Convert.FromBase64String(saltBase64);
            using var deriveBytes = new Rfc2898DeriveBytes(masterPassword, salt, 100_000, HashAlgorithmName.SHA256);
            return deriveBytes.GetBytes(32);
        }

        public static string EncryptPrivateKey(BigInteger privateKey, string masterPassword, string saltBase64)
        {
            byte[] key = DeriveAesKey(masterPassword, saltBase64);
            byte[] iv = RandomNumberGenerator.GetBytes(16);

            using Aes aes = Aes.Create();
            aes.Key = key;
            aes.IV = iv;

            byte[] data = privateKey.ToByteArray();
            if (data[^1] == 0)
            {
                Array.Resize(ref data, data.Length - 1);
            }

            byte[] encrypted = aes.CreateEncryptor().TransformFinalBlock(data, 0, data.Length);

            byte[] combined = new byte[iv.Length + encrypted.Length];
            Buffer.BlockCopy(iv, 0, combined, 0, iv.Length);
            Buffer.BlockCopy(encrypted, 0, combined, iv.Length, encrypted.Length);

            return Convert.ToBase64String(combined);
        }

        public static BigInteger DecryptPrivateKey(string encryptedBase64, string masterPassword, string saltBase64)
        {
            byte[] combined = Convert.FromBase64String(encryptedBase64);
            byte[] iv = new byte[16];
            byte[] encrypted = new byte[combined.Length - 16];

            Buffer.BlockCopy(combined, 0, iv, 0, 16);
            Buffer.BlockCopy(combined, 16, encrypted, 0, encrypted.Length);

            byte[] key = DeriveAesKey(masterPassword, saltBase64);

            using Aes aes = Aes.Create();
            aes.Key = key;
            aes.IV = iv;

            byte[] decrypted = aes.CreateDecryptor().TransformFinalBlock(encrypted, 0, encrypted.Length);
            return new BigInteger(decrypted.Concat(new byte[] { 0 }).ToArray());
        }
    }
}
