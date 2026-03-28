using System.Globalization;
using System.Text;

namespace KuznyechikLib
{
    public static class StringBytesConvertation
    {
        public static string BytesToHexString(byte[] bytes)
        {
            var builder = new StringBuilder(bytes.Length * 2);

            foreach (byte value in bytes)
            {
                builder.Append(value.ToString("X2", CultureInfo.InvariantCulture));
            }

            return builder.ToString();
        }

        public static byte[] HexStringToBytes(string hex)
        {
            if (hex.Length % 2 != 0)
            {
                throw new ArgumentException("Hex string must have even length.", nameof(hex));
            }

            var result = new byte[hex.Length / 2];

            for (int index = 0; index < result.Length; index++)
            {
                result[index] = byte.Parse(hex.AsSpan(index * 2, 2), NumberStyles.HexNumber, CultureInfo.InvariantCulture);
            }

            return result;
        }
    }
}
