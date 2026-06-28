using System;
using System.Buffers;

namespace KuznyechikLib.CipherMode
{
    public class CounterMode_CTR_ : BlockCipherModeBase
    {
        public CounterMode_CTR_(byte[] key, LinearTransformImplementation implementation = LinearTransformImplementation.Standard)
            : base(key, implementation)
        {
        }

        //public byte[] Encrypt(byte[] data, byte[] counter)
        //{
        //    return Apply(data, counter);
        //}

        public byte[] Encrypt(byte[] data, byte[] counter)
        {
            byte[] result = (byte[])data.Clone();
            ApplyInPlace(result, counter);
            return result;
        }

        public byte[] Decrypt(byte[] data, byte[] counter)
        {
            return Encrypt(data, counter);
        }

        public string Encrypt(string hexData, string hexCounter)
        {
            return StringBytesConvertation.BytesToHexString(
                Encrypt(StringBytesConvertation.HexStringToBytes(hexData), StringBytesConvertation.HexStringToBytes(hexCounter)));
        }

        public string Decrypt(string hexData, string hexCounter)
        {
            return StringBytesConvertation.BytesToHexString(
                Decrypt(StringBytesConvertation.HexStringToBytes(hexData), StringBytesConvertation.HexStringToBytes(hexCounter)));
        }
        public void TransformStream(Stream input, Stream output, byte[] initialCounter, int bufferSize = 4 * 1024 * 1024)
        {
            if (!input.CanRead) throw new ArgumentException("Input stream must be readable");
            if (!output.CanWrite) throw new ArgumentException("Output stream must be writable");

            byte[] counter = ValidateAndCloneIv(initialCounter);
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
                        Cipher.EncryptBlock(counter, gamma);

                        int toProcess = Math.Min(BlockSize, bytesRead - pos);
                        var currentSlice = dataSpan.Slice(pos, toProcess);

                        for (int i = 0; i < toProcess; i++)
                        {
                            currentSlice[i] ^= gamma[i];
                        }

                        IncrementCounter(counter);
                        pos += toProcess;
                    }

                    output.Write(buffer, 0, bytesRead);
                }
            }
            finally
            {
                ArrayPool<byte>.Shared.Return(buffer);
            }
        }

        private byte[] Apply(byte[] data, byte[] initialCounter)
        {
            byte[] counter = ValidateAndCloneIv(initialCounter);
            byte[] result = new byte[data.Length];
            Span<byte> gamma = stackalloc byte[BlockSize];

            for (int offset = 0; offset < data.Length; offset += BlockSize)
            {
                Cipher.EncryptBlock(counter, gamma);
                int count = Math.Min(BlockSize, data.Length - offset);

                for (int i = 0; i < count; i++)
                {
                    result[offset + i] = (byte)(data[offset + i] ^ gamma[i]);
                }

                IncrementCounter(counter);
            }

            return result;
        }
        private void ApplyInPlace(Span<byte> data, byte[] initialCounter)
        {
            byte[] counter = ValidateAndCloneIv(initialCounter);
            Span<byte> gamma = stackalloc byte[BlockSize];

            for (int offset = 0; offset < data.Length; offset += BlockSize)
            {
                Cipher.EncryptBlock(counter, gamma);

                int count = Math.Min(BlockSize, data.Length - offset);
                var dataSlice = data.Slice(offset, count);
                var gammaSlice = gamma.Slice(0, count);

                for (int i = 0; i < count; i++)
                {
                    dataSlice[i] ^= gammaSlice[i];
                }

                IncrementCounter(counter);
            }
        }
    }
}
