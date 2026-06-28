using System;
using System.Buffers;

namespace KuznyechikLib.CipherMode
{
    public class CipherFeedback_CFB_ : BlockCipherModeBase
    {
        public CipherFeedback_CFB_(byte[] key, LinearTransformImplementation implementation = LinearTransformImplementation.Standard)
            : base(key, implementation)
        {
        }

        public byte[] Encrypt(byte[] data, byte[] iv)
        {
            byte[] feedback = ValidateAndCloneIv(iv);
            byte[] result = new byte[data.Length];
            Span<byte> gamma = stackalloc byte[BlockSize];

            for (int offset = 0; offset < data.Length; offset += BlockSize)
            {
                Cipher.EncryptBlock(feedback, gamma);

                int count = Math.Min(BlockSize, data.Length - offset);

                for (int i = 0; i < count; i++)
                {
                    result[offset + i] = (byte)(data[offset + i] ^ gamma[i]);
                }

                if (count == BlockSize)
                {
                    Array.Copy(result, offset, feedback, 0, BlockSize);
                }
            }

            return result;
        }

        public byte[] Decrypt(byte[] data, byte[] iv)
        {
            byte[] feedback = ValidateAndCloneIv(iv);
            byte[] result = new byte[data.Length];
            Span<byte> gamma = stackalloc byte[BlockSize];

            for (int offset = 0; offset < data.Length; offset += BlockSize)
            {
                Cipher.EncryptBlock(feedback, gamma);

                int count = Math.Min(BlockSize, data.Length - offset);

                for (int i = 0; i < count; i++)
                {
                    result[offset + i] = (byte)(data[offset + i] ^ gamma[i]);
                }

                if (count == BlockSize)
                {
                    Array.Copy(data, offset, feedback, 0, BlockSize);
                }
            }

            return result;
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

        public void TransformStream(Stream input, Stream output, byte[] iv,
            bool isEncrypt, int bufferSize = 4 * 1024 * 1024)
        {
            if (!input.CanRead) throw new ArgumentException("Input stream must be readable");
            if (!output.CanWrite) throw new ArgumentException("Output stream must be writable");

            byte[] feedback = ValidateAndCloneIv(iv);
            byte[] buffer = ArrayPool<byte>.Shared.Rent(bufferSize);
            Span<byte> gamma = stackalloc byte[BlockSize];

            try
            {
                int bytesRead;
                while ((bytesRead = input.Read(buffer, 0, bufferSize)) > 0)
                {
                    Span<byte> dataSpan = buffer.AsSpan(0, bytesRead);
                    int pos = 0;

                    while (pos < bytesRead)
                    {
                        Cipher.EncryptBlock(feedback, gamma);

                        int count = Math.Min(BlockSize, bytesRead - pos);
                        var slice = dataSpan.Slice(pos, count);

                        for (int i = 0; i < count; i++)
                        {
                            slice[i] ^= gamma[i];
                        }

                        if (count == BlockSize)
                        {
                            if (isEncrypt)
                                slice.CopyTo(feedback); 
                            else
                                dataSpan.Slice(pos, count).CopyTo(feedback);
                        }

                        pos += count;
                    }

                    output.Write(buffer, 0, bytesRead);
                }
            }
            finally
            {
                ArrayPool<byte>.Shared.Return(buffer);
            }
        }

        public void EncryptStream(Stream input, Stream output, byte[] iv, int bufferSize = 4 * 1024 * 1024)
            => TransformStream(input, output, iv, true, bufferSize);

        public void DecryptStream(Stream input, Stream output, byte[] iv, int bufferSize = 4 * 1024 * 1024)
            => TransformStream(input, output, iv, false, bufferSize);
    }
}
