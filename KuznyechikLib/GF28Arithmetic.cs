namespace KuznyechikLib
{
    public static class GF28Arithmetic
    {
        private const byte ReducingPolynomial = 0xC3;

        public static byte Multiply(byte left, byte right)
        {
            int result = 0;
            int a = left;
            int b = right;

            while (b > 0)
            {
                if ((b & 1) != 0)
                {
                    result ^= a;
                }

                bool carry = (a & 0x80) != 0;
                a = (a << 1) & 0xFF;
                if (carry)
                {
                    a ^= ReducingPolynomial;
                }

                b >>= 1;
            }

            return (byte)result;
        }

        public static byte[,] CreateMultiplyTable()
        {
            var table = new byte[256, 256];

            for (int left = 0; left < 256; left++)
            {
                for (int right = 0; right < 256; right++)
                {
                    table[left, right] = Multiply((byte)left, (byte)right);
                }
            }

            return table;
        }
    }
}
