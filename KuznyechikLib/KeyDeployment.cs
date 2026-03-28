namespace KuznyechikLib
{
    public static class KeyDeployment
    {
        private const int AmountConstants = 32;

        public static byte[][] GetIterationConstants()
        {
            byte[][] result = new byte[AmountConstants][];

            for (int i = 0; i < AmountConstants; i++)
            {
                byte[] vector = new byte[Transformations.BLOCK_SIZE];
                vector[15] = (byte)(i + 1);
                result[i] = Transformations.L(vector);
            }

            return result;
        }

        public static byte[][] FeistelChain(byte[] key1, byte[] key2, byte[] c)
        {
            byte[] outKey2 = key1;
            byte[] temp = Transformations.X(key1, c);
            temp = Transformations.S(temp);
            temp = Transformations.L(temp);
            byte[] outKey1 = Transformations.X(temp, key2);

            return new[] { outKey1, outKey2 };
        }

        public static void ExpandKey(byte[] key1, byte[] key2, ref byte[][] iterKey, byte[][] iterConst)
        {
            byte[][] it12 = new byte[2][];
            byte[][] it34;

            iterKey[0] = key1;
            iterKey[1] = key2;

            it12[0] = key1;
            it12[1] = key2;

            for (int i = 0; i < 4; i++)
            {
                it34 = FeistelChain(it12[0], it12[1], iterConst[0 + 8 * i]);
                it12 = FeistelChain(it34[0], it34[1], iterConst[1 + 8 * i]);

                it34 = FeistelChain(it12[0], it12[1], iterConst[2 + 8 * i]);
                it12 = FeistelChain(it34[0], it34[1], iterConst[3 + 8 * i]);

                it34 = FeistelChain(it12[0], it12[1], iterConst[4 + 8 * i]);
                it12 = FeistelChain(it34[0], it34[1], iterConst[5 + 8 * i]);

                it34 = FeistelChain(it12[0], it12[1], iterConst[6 + 8 * i]);
                it12 = FeistelChain(it34[0], it34[1], iterConst[7 + 8 * i]);

                iterKey[2 * i + 2] = it12[0];
                iterKey[2 * i + 3] = it12[1];
            }
        }

        public static byte[][] SlpitMasterKey(byte[] key)
        {
            byte[][] result = [new byte[key.Length / 2], new byte[key.Length / 2]];

            for (int i = 0; i < key.Length / 2; i++)
            {
                result[0][i] = key[i];
                result[1][key.Length / 2 - 1 - i] = key[key.Length - 1 - i];
            }

            return result;
        }
    }
}
