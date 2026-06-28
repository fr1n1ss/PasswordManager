using System.Buffers;

namespace KuznyechikLib.CipherMode
{
    public class OutputFeedback_OFB_ : BlockCipherModeBase
    {
        public OutputFeedback_OFB_(byte[] key, LinearTransformImplementation implementation = LinearTransformImplementation.Standard)
            : base(key, implementation)
        {
        }

        public byte[] Encrypt(byte[] data, byte[] iv)
        {
            return Apply(data, iv);
        }

        public byte[] Decrypt(byte[] data, byte[] iv)
        {
            return Apply(data, iv);
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

        private byte[] Apply(byte[] data, byte[] iv)
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

                gamma.CopyTo(feedback);
            }

            return result;
        }
        public void TransformStream(Stream input, Stream output, byte[] iv, int bufferSize = 4 * 1024 * 1024)
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

                        gamma.CopyTo(feedback);

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
    }
}
