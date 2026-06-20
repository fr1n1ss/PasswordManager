using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using ZXing;
using ZXing.ImageSharp;

namespace PasswordManagerAPI.Services
{
    public class QrReaderService : IQrReaderService
    {
        public string? ReadQrCode(Stream stream)
        {
            using var image = Image.Load<Rgba32>(stream);
            var reader = new ZXing.ImageSharp.BarcodeReader<Rgba32>
            {
                Options =
                {
                    PossibleFormats = new[] { BarcodeFormat.QR_CODE },
                    TryHarder = true
                },
                AutoRotate = true
            };

            return reader.Decode(image)?.Text;
        }
    }
}
