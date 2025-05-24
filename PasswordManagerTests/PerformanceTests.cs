using RSAEncryptions;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace PasswordManagerTests
{
    [TestClass]
    public class PerformanceTests
    {
        private RSAEncryption _rsa;

        [TestInitialize]
        public void Setup()
        {
            _rsa = new RSAEncryption();
        }

        [TestMethod]
        public void MeasureRSAEncryptionTime_1KBText()
        {
            // Arrange
            string text = new string('A', 1024); // 1 KB текста (примерно 1024 символа)
            var stopwatch = new Stopwatch();

            // Act
            stopwatch.Start();
            string encryptedText = _rsa.EncryptText(text);
            stopwatch.Stop();

            // Assert
            long elapsedMilliseconds = stopwatch.ElapsedMilliseconds;
            Console.WriteLine($"RSA Encryption Time for 1KB: {elapsedMilliseconds} ms");
            Assert.IsTrue(elapsedMilliseconds < 500, $"Шифрование 1 KB текста заняло {elapsedMilliseconds} мс, что больше ожидаемого (1000 мс)");
        }

        [TestMethod]
        public void MeasureRSADecryptionTime_1KBText()
        {
            // Arrange
            string text = new string('A', 1024); // 1 KB текста
            string encryptedText = _rsa.EncryptText(text);
            var stopwatch = new Stopwatch();

            // Act
            stopwatch.Start();
            string decryptedText = _rsa.DecryptText(encryptedText);
            stopwatch.Stop();

            // Assert
            long elapsedMilliseconds = stopwatch.ElapsedMilliseconds;
            Console.WriteLine($"RSA Decryption Time for 1KB: {elapsedMilliseconds} ms");
            Assert.IsTrue(elapsedMilliseconds < 500, $"Расшифрование 1 KB текста заняло {elapsedMilliseconds} мс, что больше ожидаемого (1000 мс)");
        }
    }
}
