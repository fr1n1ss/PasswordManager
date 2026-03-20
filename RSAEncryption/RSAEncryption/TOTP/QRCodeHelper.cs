using QRCoder;
namespace Security.TOTP
{
    public static class QRCodeHelper
    {
        public static void Generate(string data, string filePath = "qrcode.png")
        {
            using var generator = new QRCodeGenerator();
            var qrData = generator.CreateQrCode(data, QRCodeGenerator.ECCLevel.Q);
            var qrCode = new PngByteQRCode(qrData);

            byte[] bytes = qrCode.GetGraphic(20);

            File.WriteAllBytes(filePath, bytes);
        }
    }
}
