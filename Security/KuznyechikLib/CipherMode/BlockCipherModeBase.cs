using System;

namespace KuznyechikLib.CipherMode
{
    public abstract class BlockCipherModeBase
    {
        protected const int BlockSize = Transformations.BLOCK_SIZE;
        protected readonly Kuznyechik Cipher;

        protected BlockCipherModeBase(byte[] key, LinearTransformImplementation implementation = LinearTransformImplementation.Standard)
        {
            Cipher = new Kuznyechik(key, implementation);
        }

        protected static byte[] ApplyPadding(byte[] data)
        {
            int padding = BlockSize - (data.Length % BlockSize);
            if (padding == 0)
            {
                padding = BlockSize;
            }

            byte[] padded = new byte[data.Length + padding];
            Array.Copy(data, padded, data.Length);

            for (int i = data.Length; i < padded.Length; i++)
            {
                padded[i] = (byte)padding;
            }

            return padded;
        }

        protected static byte[] RemovePadding(byte[] data)
        {
            if (data.Length == 0 || data.Length % BlockSize != 0)
            {
                throw new ArgumentException("Invalid data length for PKCS#7 unpadding.");
            }

            int padding = data[^1];
            if (padding <= 0 || padding > BlockSize)
            {
                throw new ArgumentException("Invalid padding.");
            }

            for (int i = data.Length - padding; i < data.Length; i++)
            {
                if (data[i] != padding)
                {
                    throw new ArgumentException("Invalid padding.");
                }
            }

            byte[] result = new byte[data.Length - padding];
            Array.Copy(data, result, result.Length);
            return result;
        }

        protected static byte[] CopyBlock(byte[] source, int offset)
        {
            byte[] block = new byte[BlockSize];
            Array.Copy(source, offset, block, 0, BlockSize);
            return block;
        }

        protected static void XorBlocks(ReadOnlySpan<byte> left, ReadOnlySpan<byte> right, Span<byte> destination)
        {
            for (int i = 0; i < BlockSize; i++)
            {
                destination[i] = (byte)(left[i] ^ right[i]);
            }
        }

        protected static void ValidateBlockMultiple(byte[] data, string parameterName)
        {
            if (data.Length % BlockSize != 0)
            {
                throw new ArgumentException("Data length must be a multiple of 16 bytes.", parameterName);
            }
        }

        protected static byte[] ValidateAndCloneIv(byte[] iv)
        {
            if (iv.Length != BlockSize)
            {
                throw new ArgumentException("IV must contain exactly 16 bytes.", nameof(iv));
            }

            return (byte[])iv.Clone();
        }

        protected static byte[] XorWithKeystream(byte[] data, byte[] keystream, int offset, int count)
        {
            byte[] result = new byte[count];
            for (int i = 0; i < count; i++)
            {
                result[i] = (byte)(data[offset + i] ^ keystream[i]);
            }

            return result;
        }

        protected static void IncrementCounter(byte[] counter)
        {
            for (int i = counter.Length - 1; i >= 0; i--)
            {
                counter[i]++;
                if (counter[i] != 0)
                {
                    break;
                }
            }
        }
    }
}
