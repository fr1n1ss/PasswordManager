namespace KuznyechikLib
{
    public static class GF28Arithmetic
    {
        //для кузнечика образующий полином x^8 + x^7 + x^6 + x + 1. В двоичной системе это 111000011 = 451 в десятичной. 451 mod 2^8 = 195.
        public static byte Multiply(byte a, byte b, byte mod = 195)
        {
            byte result = 0;

            for (int i = 0; i < 8; i++)
            {
                if ((b & 1) != 0)
                    result ^= a;

                bool highBitSet = (a & 0x80) != 0; // старший бит не равен x^7, т.е. 10000000 в двоичной = 128 в десятичной = 80 в hex

                a <<= 1;

                if (highBitSet)
                    a ^= mod;

                b >>= 1;
            }

            return result;
        }

        public static byte[,] CreateMultiplyTable(byte mod = 195)
        {
            byte[,] result = new byte[256, 256];

            for(int i = 0; i < 256; i++)
            {
                for(int j = 0; j < 256; j++)
                {
                    result[i, j] = Multiply((byte)i, (byte)j, mod);
                }
            }

            return result;
        }
    }
}
