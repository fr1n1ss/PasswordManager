using System;
using System.Buffers.Binary;

namespace KuznyechikLib
{
    public enum LinearTransformImplementation
    {
        Standard,
        Matrix,
        MatrixTables
    }

    public class Transformations
    {
        private static readonly byte[] PI =
        [
            252, 238, 221, 17, 207, 110, 49, 22, 251, 196, 250, 218, 35, 197, 4, 77, 233, 119, 240, 219, 147,
            46, 153, 186, 23, 54, 241, 187, 20, 205, 95, 193, 249, 24, 101, 90, 226, 92, 239, 33, 129, 28, 60, 66,
            139, 1, 142, 79, 5, 132, 2, 174, 227, 106, 143, 160, 6, 11, 237, 152, 127, 212, 211, 31, 235, 52, 44, 81,
            234, 200, 72, 171, 242, 42, 104, 162, 253, 58, 206, 204, 181, 112, 14, 86, 8, 12, 118, 18, 191, 114, 19,
            71, 156, 183, 93, 135, 21, 161, 150, 41, 16, 123, 154, 199, 243, 145, 120, 111, 157, 158, 178, 177, 50,
            117, 25, 61, 255, 53, 138, 126, 109, 84, 198, 128, 195, 189, 13, 87, 223, 245, 36, 169, 62, 168, 67,
            201, 215, 121, 214, 246, 124, 34, 185, 3, 224, 15, 236, 222, 122, 148, 176, 188, 220, 232, 40, 80, 78,
            51, 10, 74, 167, 151, 96, 115, 30, 0, 98, 68, 26, 184, 56, 130, 100, 159, 38, 65, 173, 69, 70, 146, 39,
            94, 85, 47, 140, 163, 165, 125, 105, 213, 149, 59, 7, 88, 179, 64, 134, 172, 29, 247, 48, 55, 107, 228,
            136, 217, 231, 137, 225, 27, 131, 73, 76, 63, 248, 254, 141, 83, 170, 144, 202, 216, 133, 97, 32, 113,
            103, 164, 45, 43, 9, 91, 203, 155, 37, 208, 190, 229, 108, 82, 89, 166, 116, 210, 230, 244, 180, 192,
            209, 102, 175, 194, 57, 75, 99, 182
        ];

        private static readonly byte[] PI_INVERSE =
        [
            165, 45, 50, 143, 14, 48, 56, 192, 84, 230, 158, 57, 85, 126, 82, 145, 100, 3, 87, 90, 28, 96, 7, 24, 33, 114, 168, 209, 41,
            198, 164, 63, 224, 39, 141, 12, 130, 234, 174, 180, 154, 99, 73, 229, 66, 228, 21, 183, 200, 6, 112, 157, 65, 117, 25, 201,
            170, 252, 77, 191, 42, 115, 132, 213, 195, 175, 43, 134, 167, 177, 178, 91, 70, 211, 159, 253, 212, 15, 156, 47, 155, 67, 239,
            217, 121, 182, 83, 127, 193, 240, 35, 231, 37, 94, 181, 30, 162, 223, 166, 254, 172, 34, 249, 226, 74, 188, 53, 202, 238, 120,
            5, 107, 81, 225, 89, 163, 242, 113, 86, 17, 106, 137, 148, 101, 140, 187, 119, 60, 123, 40, 171, 210, 49, 222, 196, 95, 204, 207,
            118, 44, 184, 216, 46, 54, 219, 105, 179, 20, 149, 190, 98, 161, 59, 22, 102, 233, 92, 108, 109, 173, 55, 97, 75, 185, 227, 186,
            241, 160, 133, 131, 218, 71, 197, 176, 51, 250, 150, 111, 110, 194, 246, 80, 255, 93, 169, 142, 23, 27, 151, 125, 236, 88, 247, 31,
            251, 124, 9, 13, 122, 103, 69, 135, 220, 232, 79, 29, 78, 4, 235, 248, 243, 62, 61, 189, 138, 136, 221, 205, 11, 19, 152, 2, 147,
            128, 144, 208, 36, 52, 203, 237, 244, 206, 153, 16, 68, 64, 146, 58, 1, 38, 18, 26, 72, 104, 245, 129, 139, 199, 214,
            32, 10, 8, 0, 76, 215, 116
        ];

        private static readonly byte[] L_VECTOR =
        [
            148, 32, 133, 16, 194, 192, 1, 251, 1, 192, 194, 16, 133, 32, 148, 1
        ];

        public const int BLOCK_SIZE = 16;

        private static readonly byte[,] MULTIPLY_TABLE = GF28Arithmetic.CreateMultiplyTable();
        private static readonly byte[,] L_MATRIX;
        private static readonly byte[,] L_INVERSE_MATRIX;
        private static readonly byte[,,] L_TABLES;
        private static readonly byte[,,] L_INVERSE_TABLES;
        private static readonly ulong[] L_TABLES_LOW = new ulong[BLOCK_SIZE * 256];
        private static readonly ulong[] L_TABLES_HIGH = new ulong[BLOCK_SIZE * 256];
        private static readonly ulong[] L_INVERSE_TABLES_LOW = new ulong[BLOCK_SIZE * 256];
        private static readonly ulong[] L_INVERSE_TABLES_HIGH = new ulong[BLOCK_SIZE * 256];

        static Transformations()
        {
            L_MATRIX = BuildMatrix(ApplyLStandard);
            L_INVERSE_MATRIX = BuildMatrix(ApplyLInverseStandard);
            L_TABLES = BuildContributionTables(L_MATRIX);
            L_INVERSE_TABLES = BuildContributionTables(L_INVERSE_MATRIX);
            BuildPackedContributionTables(L_TABLES, L_TABLES_LOW, L_TABLES_HIGH);
            BuildPackedContributionTables(L_INVERSE_TABLES, L_INVERSE_TABLES_LOW, L_INVERSE_TABLES_HIGH);
        }

        public static byte[] X(byte[] a, byte[] b)
        {
            byte[] c = new byte[BLOCK_SIZE];

            for (int i = 0; i < BLOCK_SIZE; i++)
            {
                c[i] = (byte)(a[i] ^ b[i]);
            }

            return c;
        }

        public static byte[] S(byte[] input_data)
        {
            byte[] result = new byte[input_data.Length];

            for (int i = 0; i < BLOCK_SIZE; i++)
            {
                result[i] = PI[input_data[i]];
            }

            return result;
        }

        public static byte ApplySBox(byte value)
        {
            return PI[value];
        }

        public static byte[] SInverse(byte[] input_data)
        {
            byte[] result = new byte[input_data.Length];

            for (int i = 0; i < BLOCK_SIZE; i++)
            {
                result[i] = PI_INVERSE[input_data[i]];
            }

            return result;
        }

        public static byte ApplyInverseSBox(byte value)
        {
            return PI_INVERSE[value];
        }

        public static byte[] L(byte[] input_data, LinearTransformImplementation implementation = LinearTransformImplementation.Standard)
        {
            return implementation switch
            {
                LinearTransformImplementation.Standard => ApplyLStandard(input_data),
                LinearTransformImplementation.Matrix => ApplyMatrix(input_data, L_MATRIX),
                LinearTransformImplementation.MatrixTables => ApplyTables(input_data, L_TABLES),
                _ => throw new ArgumentOutOfRangeException(nameof(implementation))
            };
        }

        public static byte[] LInverse(byte[] input_data, LinearTransformImplementation implementation = LinearTransformImplementation.Standard)
        {
            return implementation switch
            {
                LinearTransformImplementation.Standard => ApplyLInverseStandard(input_data),
                LinearTransformImplementation.Matrix => ApplyMatrix(input_data, L_INVERSE_MATRIX),
                LinearTransformImplementation.MatrixTables => ApplyTables(input_data, L_INVERSE_TABLES),
                _ => throw new ArgumentOutOfRangeException(nameof(implementation))
            };
        }

        public static byte[] R(byte[] input_data)
        {
            byte[] result = new byte[BLOCK_SIZE];
            byte b_0 = 0;

            for (int i = 0; i < BLOCK_SIZE; i++)
            {
                if (i != 0)
                {
                    result[i] = input_data[i - 1];
                }

                b_0 ^= MULTIPLY_TABLE[input_data[i], L_VECTOR[i]];
            }

            result[0] = b_0;

            return result;
        }

        public static byte[] RInverse(byte[] input_data)
        {
            byte[] result = new byte[BLOCK_SIZE];
            byte sum = 0;

            for (int i = 0; i < BLOCK_SIZE - 1; i++)
            {
                result[i] = input_data[i + 1];
                sum ^= MULTIPLY_TABLE[result[i], L_VECTOR[i]];
            }

            result[BLOCK_SIZE - 1] = (byte)(input_data[0] ^ sum);

            return result;
        }

        public static byte[,] GetLMatrix()
        {
            return CloneMatrix(L_MATRIX);
        }

        public static byte[,] GetLInverseMatrix()
        {
            return CloneMatrix(L_INVERSE_MATRIX);
        }

        public static void ApplyLMatrixTables(ReadOnlySpan<byte> input, Span<byte> output)
        {
            ApplyPackedTables(input, output, L_TABLES_LOW, L_TABLES_HIGH);
        }

        public static void ApplyLInverseMatrixTables(ReadOnlySpan<byte> input, Span<byte> output)
        {
            ApplyPackedTables(input, output, L_INVERSE_TABLES_LOW, L_INVERSE_TABLES_HIGH);
        }

        private static byte[] ApplyLStandard(byte[] inputData)
        {
            byte[] result = (byte[])inputData.Clone();

            for (int i = 0; i < BLOCK_SIZE; i++)
            {
                result = R(result);
            }

            return result;
        }

        private static byte[] ApplyLInverseStandard(byte[] inputData)
        {
            byte[] result = (byte[])inputData.Clone();

            for (int i = 0; i < BLOCK_SIZE; i++)
            {
                result = RInverse(result);
            }

            return result;
        }

        private static byte[,] BuildMatrix(Func<byte[], byte[]> transform)
        {
            byte[,] matrix = new byte[BLOCK_SIZE, BLOCK_SIZE];

            for (int column = 0; column < BLOCK_SIZE; column++)
            {
                byte[] basisVector = new byte[BLOCK_SIZE];
                basisVector[column] = 1;
                byte[] transformed = transform(basisVector);

                for (int row = 0; row < BLOCK_SIZE; row++)
                {
                    matrix[row, column] = transformed[row];
                }
            }

            return matrix;
        }

        private static byte[,,] BuildContributionTables(byte[,] matrix)
        {
            byte[,,] tables = new byte[BLOCK_SIZE, 256, BLOCK_SIZE];

            for (int column = 0; column < BLOCK_SIZE; column++)
            {
                for (int value = 0; value < 256; value++)
                {
                    for (int row = 0; row < BLOCK_SIZE; row++)
                    {
                        tables[column, value, row] = MULTIPLY_TABLE[matrix[row, column], value];
                    }
                }
            }

            return tables;
        }

        private static void BuildPackedContributionTables(byte[,,] source, ulong[] low, ulong[] high)
        {
            byte[] buffer = new byte[BLOCK_SIZE];

            for (int column = 0; column < BLOCK_SIZE; column++)
            {
                for (int value = 0; value < 256; value++)
                {
                    for (int row = 0; row < BLOCK_SIZE; row++)
                    {
                        buffer[row] = source[column, value, row];
                    }

                    int index = (column << 8) | value;
                    low[index] = BinaryPrimitives.ReadUInt64LittleEndian(buffer.AsSpan(0, 8));
                    high[index] = BinaryPrimitives.ReadUInt64LittleEndian(buffer.AsSpan(8, 8));
                }
            }
        }

        private static byte[] ApplyMatrix(byte[] inputData, byte[,] matrix)
        {
            byte[] result = new byte[BLOCK_SIZE];

            for (int row = 0; row < BLOCK_SIZE; row++)
            {
                byte sum = 0;
                for (int column = 0; column < BLOCK_SIZE; column++)
                {
                    sum ^= MULTIPLY_TABLE[matrix[row, column], inputData[column]];
                }

                result[row] = sum;
            }

            return result;
        }

        private static byte[] ApplyTables(byte[] inputData, byte[,,] tables)
        {
            byte[] result = new byte[BLOCK_SIZE];

            for (int column = 0; column < BLOCK_SIZE; column++)
            {
                byte value = inputData[column];
                for (int row = 0; row < BLOCK_SIZE; row++)
                {
                    result[row] ^= tables[column, value, row];
                }
            }

            return result;
        }

        private static void ApplyPackedTables(ReadOnlySpan<byte> input, Span<byte> output, ulong[] low, ulong[] high)
        {
            ulong lowPart = 0;
            ulong highPart = 0;

            for (int column = 0; column < BLOCK_SIZE; column++)
            {
                int index = (column << 8) | input[column];
                lowPart ^= low[index];
                highPart ^= high[index];
            }

            BinaryPrimitives.WriteUInt64LittleEndian(output[..8], lowPart);
            BinaryPrimitives.WriteUInt64LittleEndian(output[8..], highPart);
        }

        public static (ulong low, ulong high) PackBlock(byte[] block)
        {
            return (BinaryPrimitives.ReadUInt64LittleEndian(block.AsSpan(0, 8)), BinaryPrimitives.ReadUInt64LittleEndian(block.AsSpan(8, 8)));
        }

        private static byte[,] CloneMatrix(byte[,] matrix)
        {
            byte[,] copy = new byte[BLOCK_SIZE, BLOCK_SIZE];

            for (int row = 0; row < BLOCK_SIZE; row++)
            {
                for (int column = 0; column < BLOCK_SIZE; column++)
                {
                    copy[row, column] = matrix[row, column];
                }
            }

            return copy;
        }
    }
}
