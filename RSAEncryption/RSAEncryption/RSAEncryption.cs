using System.Numerics;
using System.Security.Cryptography;
using System.Text;

namespace RSAEncryptions
{
    public class RSAEncryption
    {
        public BigInteger PublicKey { get; private set; }
        public BigInteger PrivateKey { get; private set; }
        public BigInteger Modulus { get; private set; }

        private static readonly char[] CustomAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@".ToCharArray();

        public RSAEncryption()
        {
            GenerateKeys();
        }

        private void GenerateKeys()
        {
            BigInteger p = GenerateLargePrime(512);
            BigInteger q = GenerateLargePrime(512);

            Modulus = p * q;
            BigInteger phi = (p - 1) * (q - 1);

            PublicKey = 65537;
            PrivateKey = ModInverse(PublicKey, phi);
        }

        private BigInteger ModInverse(BigInteger a, BigInteger m)
        {
            BigInteger m0 = m, t, q;
            BigInteger x0 = 0, x1 = 1;
            while (a > 1)
            {
                q = a / m;
                t = m;
                m = a % m;
                a = t;
                t = x0;
                x0 = x1 - q * x0;
                x1 = t;
            }
            return (x1 + m0) % m0;
        }

        public BigInteger EncryptNumber(BigInteger message)
        {
            return BigInteger.ModPow(message, PublicKey, Modulus);
        }

        public BigInteger DecryptNumber(BigInteger cipher)
        {
            return BigInteger.ModPow(cipher, PrivateKey, Modulus);
        }

        public string EncryptText(string text)
        {
            byte[] bytes = Encoding.UTF8.GetBytes(text);
            int blockSize = (Modulus.ToByteArray().Length - 1) / 2;
            var blocks = bytes.Select((b, i) => new { b, i })
                              .GroupBy(x => x.i / blockSize)
                              .Select(g => g.Select(x => x.b).ToArray())
                              .ToList();

            var encryptedBlocks = blocks.Select(block =>
            {
                BigInteger num = new BigInteger(block);
                return EncryptNumber(num).ToByteArray().SkipWhile(b => b == 0).ToArray(); // Убираем ведущие нули
            }).ToList();

            List<byte> result = new List<byte>();
            result.AddRange(BitConverter.GetBytes((ushort)encryptedBlocks.Count)); // 2 байта на количество блоков
            foreach (var block in encryptedBlocks)
            {
                result.AddRange(BitConverter.GetBytes((ushort)block.Length)); // 2 байта на размер блока
            }
            result.AddRange(encryptedBlocks.SelectMany(b => b));

            byte[] encryptedBytes = result.ToArray();
            return BytesToCustomString(encryptedBytes); // Преобразуем в строку с алфавитом
        }

        private string BytesToCustomString(byte[] bytes)
        {
            // Преобразуем байты в биты
            List<bool> bits = new List<bool>();
            foreach (byte b in bytes)
            {
                for (int i = 7; i >= 0; i--)
                {
                    bits.Add((b & (1 << i)) != 0);
                }
            }

            // Группируем по 6 бит (64 символа = 2^6)
            StringBuilder result = new StringBuilder();
            for (int i = 0; i < bits.Count; i += 6)
            {
                int value = 0;
                for (int j = 0; j < 6 && i + j < bits.Count; j++)
                {
                    if (bits[i + j])
                    {
                        value |= 1 << (5 - j);
                    }
                }
                result.Append(CustomAlphabet[value]);
            }

            return result.ToString();
        }
        public string DecryptText(string encryptedText)
        {
            byte[] encryptedData = CustomStringToBytes(encryptedText);
            var encryptedBlocks = SplitIntoBlocks(encryptedData);

            var decryptedBlocks = encryptedBlocks.Select(block =>
            {
                BigInteger num = new BigInteger(block);
                return DecryptNumber(num).ToByteArray();
            });

            byte[] decryptedBytes = decryptedBlocks.SelectMany(b => b).ToArray();
            return Encoding.UTF8.GetString(decryptedBytes);
        }

        private byte[] CustomStringToBytes(string encryptedText)
        {
            // Преобразуем символы в биты
            List<bool> bits = new List<bool>();
            foreach (char c in encryptedText)
            {
                int index = Array.IndexOf(CustomAlphabet, c);
                if (index == -1) throw new ArgumentException("Недопустимый символ в зашифрованном тексте");

                for (int i = 5; i >= 0; i--)
                {
                    bits.Add((index & (1 << i)) != 0);
                }
            }

            // Преобразуем биты в байты
            List<byte> bytes = new List<byte>();
            for (int i = 0; i < bits.Count; i += 8)
            {
                byte b = 0;
                for (int j = 0; j < 8 && i + j < bits.Count; j++)
                {
                    if (bits[i + j])
                    {
                        b |= (byte)(1 << (7 - j));
                    }
                }
                bytes.Add(b);
            }

            return bytes.ToArray();
        }

        private List<byte[]> SplitIntoBlocks(byte[] encryptedData)
        {
            List<byte[]> blocks = new List<byte[]>();

            if (encryptedData.Length < 2)
                throw new ArgumentException("Недостаточно данных для извлечения блоков");

            int blockCount = BitConverter.ToUInt16(encryptedData, 0);
            int offset = 2;

            int[] blockSizes = new int[blockCount];
            for (int i = 0; i < blockCount; i++)
            {
                if (offset + 2 > encryptedData.Length)
                    throw new ArgumentException("Недостаточно данных для чтения размеров блоков");
                blockSizes[i] = BitConverter.ToUInt16(encryptedData, offset);
                offset += 2;
            }

            for (int i = 0; i < blockCount; i++)
            {
                int blockSize = blockSizes[i];
                if (offset + blockSize > encryptedData.Length)
                    throw new ArgumentException("Недостаточно данных для чтения блока");

                byte[] block = new byte[blockSize];
                Array.Copy(encryptedData, offset, block, 0, blockSize);
                blocks.Add(block);
                offset += blockSize;
            }

            return blocks;
        }
        public void OverrideKeys(BigInteger publicKey, BigInteger privateKey, BigInteger modulus)
        {
            PublicKey = publicKey;
            PrivateKey = privateKey;
            Modulus = modulus;
        }
        private BigInteger GenerateLargePrime(int bitLength = 512)
        {
            BigInteger number;

            do
            {
                number = GenerateRandomOddBigInteger(bitLength);
            } while (!IsProbablyPrime(number, 20));

            return number;
        }

        private BigInteger GenerateRandomOddBigInteger(int bitLength)
        {
            int byteLength = (bitLength + 7) / 8;
            byte[] bytes = new byte[byteLength];

            RandomNumberGenerator.Fill(bytes);

            // Устанавливаем старший бит, чтобы число было заданной длины
            bytes[bytes.Length - 1] |= (byte)(1 << ((bitLength - 1) % 8));
            // Делаем число нечётным
            bytes[0] |= 0x01;

            return new BigInteger(bytes, isUnsigned: true, isBigEndian: true);
        }

        private bool IsProbablyPrime(BigInteger n, int k)
        {
            if (n <= 1) return false;
            if (n == 2 || n == 3) return true;
            if (n % 2 == 0) return false;

            BigInteger d = n - 1;
            int r = 0;
            while (d % 2 == 0)
            {
                d /= 2;
                r++;
            }

            for (int i = 0; i < k; i++)
            {
                BigInteger a = RandomBigInteger(2, n - 2);
                BigInteger x = BigInteger.ModPow(a, d, n);
                if (x == 1 || x == n - 1)
                    continue;

                bool continueOuter = false;
                for (int j = 0; j < r - 1; j++)
                {
                    x = BigInteger.ModPow(x, 2, n);
                    if (x == n - 1)
                    {
                        continueOuter = true;
                        break;
                    }
                }

                if (continueOuter)
                    continue;

                return false;
            }

            return true;
        }

        private BigInteger RandomBigInteger(BigInteger min, BigInteger max)
        {
            if (min >= max)
                throw new ArgumentException("min must be less than max");

            BigInteger result;
            int byteLength = max.ToByteArray().Length;
            byte[] bytes = new byte[byteLength];

            do
            {
                RandomNumberGenerator.Fill(bytes);
                result = new BigInteger(bytes, isUnsigned: true, isBigEndian: true);
            } while (result < min || result >= max);

            return result;
        }
    }
}
