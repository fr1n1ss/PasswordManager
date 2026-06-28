using System.Buffers;
using System.Runtime.Intrinsics;
using System.Runtime.Intrinsics.X86;

namespace KuznyechikLib.CipherMode
{
    public class CipherBlockChaining_CBC_ : BlockCipherModeBase
    {
        public CipherBlockChaining_CBC_(byte[] key, LinearTransformImplementation implementation = LinearTransformImplementation.Standard)
            : base(key, implementation)
        {
        }

        public byte[] Encrypt(byte[] data, byte[] iv)
        {
            byte[] padded = ApplyPadding(data);
            byte[] result = new byte[padded.Length];

            byte[] previous = new byte[BlockSize]; 
            Array.Copy(iv, previous, BlockSize);

            byte[] temp = new byte[BlockSize];

            for (int i = 0; i < padded.Length; i += BlockSize)
            {
                // XOR input с previous
                XorBlocks(padded, i, previous, 0, temp, 0);

                // Шифруем
                Cipher.EncryptBlock(temp, result.AsSpan(i, BlockSize));

                // previous = зашифрованный блок
                Array.Copy(result, i, previous, 0, BlockSize);
            }

            return result;
        }
        public void EncryptStream(Stream input, Stream output, byte[] iv, int bufferSize = 4 * 1024 * 1024)
        {
            if (!input.CanRead) throw new ArgumentException("Input stream must be readable");
            if (!output.CanWrite) throw new ArgumentException("Output stream must be writable");

            byte[] buffer = ArrayPool<byte>.Shared.Rent(bufferSize);
            byte[] previous = ValidateAndCloneIv(iv); 
            byte[] temp = new byte[BlockSize];

            try
            {
                int bytesRead;
                while ((bytesRead = input.Read(buffer, 0, bufferSize)) > 0)
                {
                    int pos = 0;

                    while (pos < bytesRead)
                    {
                        int remaining = bytesRead - pos;
                        int blockSize = Math.Min(BlockSize, remaining);

                        if (blockSize < BlockSize)
                        {
                            byte[] lastBlock = new byte[BlockSize];
                            Array.Copy(buffer, pos, lastBlock, 0, blockSize);

                            int padding = BlockSize - blockSize;
                            for (int j = blockSize; j < BlockSize; j++)
                                lastBlock[j] = (byte)padding;

                            XorBlocks(lastBlock, 0, previous, 0, temp, 0);
                            Cipher.EncryptBlock(temp, temp);

                            output.Write(temp, 0, BlockSize);
                            Array.Copy(temp, previous, BlockSize);

                            pos += blockSize;
                            break;
                        }
                        else
                        {
                            XorBlocks(buffer, pos, previous, 0, temp, 0);
                            Cipher.EncryptBlock(temp, temp);

                            output.Write(temp, 0, BlockSize);

                            Array.Copy(temp, previous, BlockSize);
                            pos += BlockSize;
                        }
                    }
                }
            }
            finally
            {
                ArrayPool<byte>.Shared.Return(buffer);
            }
        }

        public byte[] Decrypt(byte[] data, byte[] iv)
        {
            ValidateBlockMultiple(data, nameof(data));

            byte[] result = new byte[data.Length];

            byte[] previous = new byte[BlockSize];
            Array.Copy(iv, previous, BlockSize);

            byte[] decrypted = new byte[BlockSize];

            for (int i = 0; i < data.Length; i += BlockSize)
            {
                Cipher.DecryptBlock(data.AsSpan(i, BlockSize), decrypted);

                XorBlocks(decrypted, 0, previous, 0, result, i);

                Array.Copy(data, i, previous, 0, BlockSize);
            }

            return RemovePadding(result);
        }
        public void DecryptStream(Stream input, Stream output, byte[] iv, int bufferSize = 4 * 1024 * 1024)
        {
            if (!input.CanRead) throw new ArgumentException("Input stream must be readable");
            if (!output.CanWrite) throw new ArgumentException("Output stream must be writable");

            byte[] buffer = ArrayPool<byte>.Shared.Rent(bufferSize);
            byte[] previous = ValidateAndCloneIv(iv);
            byte[] decrypted = new byte[BlockSize];

            try
            {
                int bytesRead;
                while ((bytesRead = input.Read(buffer, 0, bufferSize)) > 0)
                {
                    int pos = 0;
                    while (pos < bytesRead)
                    {
                        int blockSize = Math.Min(BlockSize, bytesRead - pos);

                        if (blockSize < BlockSize)
                            throw new InvalidOperationException("Encrypted data length must be multiple of 16 bytes.");

                        Cipher.DecryptBlock(buffer.AsSpan(pos, BlockSize), decrypted);
                        XorBlocks(decrypted, 0, previous, 0, buffer, pos);

                        Array.Copy(buffer, pos, previous, 0, BlockSize);

                        pos += BlockSize;
                    }

                    output.Write(buffer, 0, bytesRead);
                }
            }
            finally
            {
                ArrayPool<byte>.Shared.Return(buffer);
            }
        }

        public string Encrypt(string hexData, string hexIv)
        {
            return StringBytesConvertation.BytesToHexString(
                Encrypt(StringBytesConvertation.HexStringToBytes(hexData), StringBytesConvertation.HexStringToBytes(hexIv)));
        }

        public string Decrypt(string hexData, string hexIv)
        {
            return StringBytesConvertation.BytesToHexString(
                Decrypt(StringBytesConvertation.HexStringToBytes(hexData), StringBytesConvertation.HexStringToBytes(hexIv)));
        }

        private static void XorBlocks(byte[] src1, int offset1, byte[] src2, int offset2, byte[] dest, int destOffset)
        {
            for (int i = 0; i < BlockSize; i++)
            {
                dest[destOffset + i] = (byte)(src1[offset1 + i] ^ src2[offset2 + i]);
            }
        }
    }
}
