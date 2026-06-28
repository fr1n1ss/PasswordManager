using System.Buffers;

namespace KuznyechikLib.CipherMode
{
    public class ElectronicCodebook_ECB_ : BlockCipherModeBase
    {
        public ElectronicCodebook_ECB_(byte[] key, LinearTransformImplementation implementation = LinearTransformImplementation.Standard)
            : base(key, implementation)
        {
        }

        public byte[] Encrypt(byte[] data)
        {
            byte[] padded = ApplyPadding(data);
            byte[] result = new byte[padded.Length];

            for (int i = 0; i < padded.Length; i += BlockSize)
            {
                Cipher.EncryptBlock(padded.AsSpan(i, BlockSize), result.AsSpan(i, BlockSize));
            }

            return result;
        }

        public string Encrypt(string hexData)
        {
            return StringBytesConvertation.BytesToHexString(Encrypt(StringBytesConvertation.HexStringToBytes(hexData)));
        }

        public byte[] Decrypt(byte[] data)
        {
            ValidateBlockMultiple(data, nameof(data));
            byte[] result = new byte[data.Length];

            for (int i = 0; i < data.Length; i += BlockSize)
            {
                Cipher.DecryptBlock(data.AsSpan(i, BlockSize), result.AsSpan(i, BlockSize));
            }

            return RemovePadding(result);
        }

        public byte[] DecryptWithoutPadding(byte[] data)
        {
            ValidateBlockMultiple(data, nameof(data));
            byte[] result = new byte[data.Length];

            for (int i = 0; i < data.Length; i += BlockSize)
            {
                Cipher.DecryptBlock(data.AsSpan(i, BlockSize), result.AsSpan(i, BlockSize));
            }

            return result;
        }

        public string Decrypt(string hexData)
        {
            return StringBytesConvertation.BytesToHexString(Decrypt(StringBytesConvertation.HexStringToBytes(hexData)));
        }

        public void EncryptStream(Stream input, Stream output, int bufferSize = 4 * 1024 * 1024)
        {
            byte[] buffer = ArrayPool<byte>.Shared.Rent(bufferSize);
            bool isLastBlock = false;

            try
            {
                int bytesRead;
                while ((bytesRead = input.Read(buffer, 0, bufferSize)) > 0)
                {
                    isLastBlock = input.Position == input.Length;

                    Span<byte> span = buffer.AsSpan(0, bytesRead);

                    if (isLastBlock && bytesRead % BlockSize != 0)
                    {
                        int padding = BlockSize - (bytesRead % BlockSize);
                        for (int j = bytesRead; j < bytesRead + padding; j++)
                        {
                            buffer[j] = (byte)padding;
                        }

                        int paddedLength = bytesRead + padding;
                        span = buffer.AsSpan(0, paddedLength);
                    }

                    for (int i = 0; i < span.Length; i += BlockSize)
                    {
                        Cipher.EncryptBlock(span.Slice(i, BlockSize), span.Slice(i, BlockSize));
                    }

                    output.Write(buffer, 0, span.Length);
                }
            }
            finally
            {
                ArrayPool<byte>.Shared.Return(buffer);
            }
        }
        public void DecryptStream(Stream input, Stream output, int bufferSize = 4 * 1024 * 1024)
        {
            byte[] buffer = ArrayPool<byte>.Shared.Rent(bufferSize);

            try
            {
                int bytesRead;
                while ((bytesRead = input.Read(buffer, 0, bufferSize)) > 0)
                {
                    if (bytesRead % BlockSize != 0)
                    {
                        throw new InvalidOperationException(
                            $"Encrypted data length must be multiple of {BlockSize} bytes for ECB mode.");
                    }

                    Span<byte> span = buffer.AsSpan(0, bytesRead);

                    for (int i = 0; i < bytesRead; i += BlockSize)
                    {
                        Cipher.DecryptBlock(span.Slice(i, BlockSize), span.Slice(i, BlockSize));
                    }

                    output.Write(buffer, 0, bytesRead);
                }
            }
            finally
            {
                ArrayPool<byte>.Shared.Return(buffer);
            }
        }
    }
}
