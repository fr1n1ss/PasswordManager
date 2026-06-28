using System;

namespace KuznyechikLib
{
    public static class KeyDeployment
    {
        private const int AMOUNT_CONSTANTS = 32;
        
        public static byte[][] GetIterationConstants()
        {
            byte[][] result = new byte[AMOUNT_CONSTANTS][];

            for (int i = 0; i < AMOUNT_CONSTANTS; i++)
            {
                byte[] vector = new byte[Transformations.BLOCK_SIZE];

                vector[15] = (byte)(i + 1);

                result[i] = Transformations.L(vector);
            }

            return result;
        }
        public static byte[][] FeistelChain(byte[] key_1, byte[] key_2, byte[] c)
        {
            byte[] temp;
            byte[] out_key_2 = key_1;

            temp = Transformations.X(key_1, c);
            temp = Transformations.S(temp);
            temp = Transformations.L(temp);

            byte[] out_key_1 = Transformations.X(temp, key_2);

            byte[][] result = new byte[2][];

            result[0] = out_key_1;
            result[1] = out_key_2;

            return result;

        }
        public static void ExpandKey(byte[] key_1, byte[] key_2, ref byte[][] iter_key, byte[][] iter_const)
        {
            byte[][] it12 = new byte[2][];
            byte[][] it34 = new byte[2][];

            iter_key[0] = key_1;
            iter_key[1] = key_2;

            it12[0] = key_1;
            it12[1] = key_2;

            for(int i = 0; i < 4; i++)
            {
                it34 = FeistelChain(it12[0], it12[1], iter_const[0 + 8 * i]);
                it12 = FeistelChain(it34[0], it34[1], iter_const[1 + 8 * i]);

                it34 = FeistelChain(it12[0], it12[1], iter_const[2 + 8 * i]);
                it12 = FeistelChain(it34[0], it34[1], iter_const[3 + 8 * i]);

                it34 = FeistelChain(it12[0], it12[1], iter_const[4 + 8 * i]);
                it12 = FeistelChain(it34[0], it34[1], iter_const[5 + 8 * i]);

                it34 = FeistelChain(it12[0], it12[1], iter_const[6 + 8 * i]);
                it12 = FeistelChain(it34[0], it34[1], iter_const[7 + 8 * i]);

                iter_key[2 * i + 2] = it12[0];
                iter_key[2 * i + 3] = it12[1];
            }
        }

        public static byte[][] SlpitMasterKey(byte[] key)
        {
            byte[][] result = [new byte[key.Length / 2], new byte[key.Length / 2]];

            for (int i = 0; i < key.Length / 2; i++)
            {
                result[0][i] = (byte)key[i];
                result[1][key.Length / 2 - 1 - i] = (byte)key[key.Length - 1 - i];
            }

            return result;
        }
    }
}
