using System.Buffers.Binary;

namespace KuznyechikLib
{
    public class Kuznyechik
    {
        private static readonly ulong[] EncryptRoundTableLow = new ulong[Transformations.BLOCK_SIZE * 256];
        private static readonly ulong[] EncryptRoundTableHigh = new ulong[Transformations.BLOCK_SIZE * 256];

        private readonly byte[][] iteration_keys = new byte[10][];
        private readonly ulong[] roundKeyLow = new ulong[10];
        private readonly ulong[] roundKeyHigh = new ulong[10];
        private readonly LinearTransformImplementation linearTransformImplementation;

        static Kuznyechik()
        {
            BuildRoundTables(EncryptRoundTableLow, EncryptRoundTableHigh);
        }

        public Kuznyechik(byte[] key, LinearTransformImplementation implementation = LinearTransformImplementation.Standard)
        {
            var keys = KeyDeployment.SlpitMasterKey(key);
            var iterationConstants = KeyDeployment.GetIterationConstants();
            KeyDeployment.ExpandKey(keys[0], keys[1], ref iteration_keys, iterationConstants);
            linearTransformImplementation = implementation;

            for (int i = 0; i < iteration_keys.Length; i++)
            {
                (roundKeyLow[i], roundKeyHigh[i]) = Transformations.PackBlock(iteration_keys[i]);
            }
        }

        public byte[] Encrypt(byte[] input)
        {
            byte[] result = new byte[Transformations.BLOCK_SIZE];
            EncryptBlock(input, result);
            return result;
        }

        public void EncryptBlock(ReadOnlySpan<byte> input, Span<byte> output)
        {
            if (linearTransformImplementation == LinearTransformImplementation.MatrixTables)
            {
                EncryptBlockFast(input, output);
                return;
            }

            byte[] result = input.ToArray();

            for (int i = 0; i < 9; i++)
            {
                result = Transformations.X(iteration_keys[i], result);
                result = Transformations.S(result);
                result = Transformations.L(result, linearTransformImplementation);
            }

            byte[] final = Transformations.X(result, iteration_keys[9]);
            final.CopyTo(output);
        }

        public string Encrypt(string hexValue)
        {
            return StringBytesConvertation.BytesToHexString(Encrypt(StringBytesConvertation.HexStringToBytes(hexValue)));
        }

        public byte[] Decrypt(byte[] input)
        {
            byte[] result = new byte[Transformations.BLOCK_SIZE];
            DecryptBlock(input, result);
            return result;
        }

        public void DecryptBlock(ReadOnlySpan<byte> input, Span<byte> output)
        {
            byte[] result = Transformations.X(input.ToArray(), iteration_keys[9]);

            for (int i = 8; i >= 0; i--)
            {
                result = Transformations.LInverse(result, linearTransformImplementation);
                result = Transformations.SInverse(result);
                result = Transformations.X(iteration_keys[i], result);
            }

            result.CopyTo(output);
        }

        public string Decrypt(string hexValue)
        {
            return StringBytesConvertation.BytesToHexString(Decrypt(StringBytesConvertation.HexStringToBytes(hexValue)));
        }

        private void EncryptBlockFast(ReadOnlySpan<byte> input, Span<byte> output)
        {
            Span<byte> state = stackalloc byte[Transformations.BLOCK_SIZE];
            input.CopyTo(state);

            for (int round = 0; round < 9; round++)
            {
                ApplyEncryptRound(state, iteration_keys[round], out ulong low, out ulong high);
                BinaryPrimitives.WriteUInt64LittleEndian(state[..8], low);
                BinaryPrimitives.WriteUInt64LittleEndian(state[8..], high);
            }

            ulong finalLow = BinaryPrimitives.ReadUInt64LittleEndian(state[..8]) ^ roundKeyLow[9];
            ulong finalHigh = BinaryPrimitives.ReadUInt64LittleEndian(state[8..]) ^ roundKeyHigh[9];

            BinaryPrimitives.WriteUInt64LittleEndian(output[..8], finalLow);
            BinaryPrimitives.WriteUInt64LittleEndian(output[8..], finalHigh);
        }

        private static void ApplyEncryptRound(ReadOnlySpan<byte> state, byte[] roundKey, out ulong low, out ulong high)
        {
            low = 0;
            high = 0;

            for (int i = 0; i < Transformations.BLOCK_SIZE; i++)
            {
                int index = (i << 8) | (state[i] ^ roundKey[i]);
                low ^= EncryptRoundTableLow[index];
                high ^= EncryptRoundTableHigh[index];
            }
        }

        private static void BuildRoundTables(ulong[] tableLow, ulong[] tableHigh)
        {
            for (int position = 0; position < Transformations.BLOCK_SIZE; position++)
            {
                for (int value = 0; value < 256; value++)
                {
                    byte[] vector = new byte[Transformations.BLOCK_SIZE];
                    vector[position] = Transformations.ApplySBox((byte)value);
                    byte[] transformed = Transformations.L(vector, LinearTransformImplementation.MatrixTables);

                    int index = (position << 8) | value;
                    tableLow[index] = BinaryPrimitives.ReadUInt64LittleEndian(transformed.AsSpan(0, 8));
                    tableHigh[index] = BinaryPrimitives.ReadUInt64LittleEndian(transformed.AsSpan(8, 8));
                }
            }
        }
    }
}
