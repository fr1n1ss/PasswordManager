using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Security.TOTP
{
    public static class Base32
    {
        private const string Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

        public static string Encode(byte[] data)
        {
            StringBuilder result = new();
            int buffer = data[0];
            int next = 1;
            int bitsLeft = 8;

            while (bitsLeft > 0 || next < data.Length)
            {
                if (bitsLeft < 5)
                {
                    if (next < data.Length)
                    {
                        buffer <<= 8;
                        buffer |= data[next++] & 0xff;
                        bitsLeft += 8;
                    }
                    else
                    {
                        int pad = 5 - bitsLeft;
                        buffer <<= pad;
                        bitsLeft += pad;
                    }
                }

                int index = (buffer >> (bitsLeft - 5)) & 31;
                bitsLeft -= 5;
                result.Append(Alphabet[index]);
            }

            return result.ToString();
        }

        public static byte[] Decode(string base32)
        {
            base32 = base32.TrimEnd('=').ToUpperInvariant();
            var bytes = new List<byte>();

            int bits = 0;
            int value = 0;

            foreach (char c in base32)
            {
                int index = Alphabet.IndexOf(c);
                if (index < 0) throw new FormatException($"Недопустимый символ Base32: {c}");

                value = (value << 5) | index;
                bits += 5;

                if (bits >= 8)
                {
                    bytes.Add((byte)((value >> (bits - 8)) & 0xFF));
                    bits -= 8;
                }
            }

            return bytes.ToArray();
        }
    }
}
