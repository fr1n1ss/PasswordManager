using System;
using System.Numerics;
using System.Security.Cryptography;
using System.Text;
using RSAEncryptions;

class Program
{

    static void Main(string[] args)
    {
        Console.OutputEncoding = Encoding.UTF8; // Для корректного вывода русского текста
        TestRSAEncryption();
    }

    static void TestRSAEncryption()
    {
        var rsa = new RSAEncryption();
        string originalText = "Hello mir";
        Console.WriteLine($"Оригинальный текст: {originalText}");

        string encryptedText = rsa.EncryptText(originalText);
        Console.WriteLine($"Зашифрованный текст: {encryptedText}");

        string decryptedText = rsa.DecryptText(encryptedText);
        Console.WriteLine($"Расшифрованный текст: {decryptedText}");
        Console.WriteLine($"Совпадение: {originalText == decryptedText}");
    }
}
