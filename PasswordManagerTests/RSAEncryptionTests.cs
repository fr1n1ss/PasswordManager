using Microsoft.VisualStudio.TestTools.UnitTesting;
using RSAEncryptions;
using System;

namespace PasswordManagerTests
{
    [TestClass]
    public class RSAEncryptionTests
    {
        private RSAEncryption _rsa;

        [TestInitialize]
        public void Setup()
        {
            _rsa = new RSAEncryption(); // ������ ���� ��������� ��� ���� ������
        }

        [TestMethod]
        public void GenerateKeys_ValidKeysGenerated()
        {
            // Assert
            Assert.IsTrue(_rsa.PublicKey > 0, "PublicKey ������ ���� ������ 0");
            Assert.IsTrue(_rsa.PrivateKey > 0, "PrivateKey ������ ���� ������ 0");
            Assert.IsTrue(_rsa.Modulus > 0, "Modulus ������ ���� ������ 0");
        }

        [TestMethod]
        public void EncryptDecryptText_ReturnsOriginalText()
        {
            // Arrange
            string originalText = "Test message";

            // Act
            string encryptedText = _rsa.EncryptText(originalText);
            string decryptedText = _rsa.DecryptText(encryptedText);

            // Assert
            Assert.AreNotEqual(originalText, encryptedText, "����� ������ ���� ����������");
            Assert.AreEqual(originalText, decryptedText, "�������������� ����� ������ ��������� � ��������");
        }

        [TestMethod]
        public void EncryptDecryptText_WithOverrideKeys_ReturnsOriginalText()
        {
            // Arrange
            string originalText = "Another test";
            var rsa2 = new RSAEncryption();
            rsa2.OverrideKeys(_rsa.PublicKey, _rsa.PrivateKey, _rsa.Modulus);

            // Act
            string encryptedText = _rsa.EncryptText(originalText);
            string decryptedText = rsa2.DecryptText(encryptedText);

            // Assert
            Assert.AreNotEqual(originalText, encryptedText, "����� ������ ���� ����������");
            Assert.AreEqual(originalText, decryptedText, "�������������� ����� ������ ��������� � ��������");
        }

        [TestMethod]
        public void DecryptText_WithWrongKeys_ThrowsException()
        {
            // Arrange
            string originalText = "Test message";
            var rsa2 = new RSAEncryption(); // ����� ����� ������

            string encryptedText = _rsa.EncryptText(originalText);

            // Act & Assert
            Assert.ThrowsException<ArgumentException>(() => rsa2.DecryptText(encryptedText),
                "������������� � ��������� ������� ������ ��������� ����������");
        }
    }
}