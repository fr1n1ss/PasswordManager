using System;
namespace KuznyechikLib
{
    public static class StringBytesConvertation
    {
        public static byte[] HexStringToBytes(string hexString)
        {
            hexString = hexString.Replace(" ", "");
            int lenght = hexString.Length;
            byte[] result = new byte[lenght / 2];

            for(int i = 0; i < lenght; i += 2)
                result[i / 2] = Convert.ToByte(hexString.Substring(i, 2), 16);

            return result;
        }

        public static string BytesToHexString(byte[] bytes) => BitConverter.ToString(bytes).Replace("-", "").ToLower();

        public static byte[] Base64StringToBytes(string base64String) => Convert.FromBase64String(base64String);
        public static string BytesToBase64String(byte[] bytes) => Convert.ToBase64String(bytes);
    }
}
