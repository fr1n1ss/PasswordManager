using System.Drawing;
using ZXing;
using ZXing.Common;
using ZXing.Windows.Compatibility;

namespace PasswordManagerAPI.Services
{
    public class QrReaderService : IQrReaderService
    {
        public string ReadQrCode(Stream stream)
        {
            using var bitmap = new Bitmap(stream);

            var source = new BitmapLuminanceSource(bitmap);
            var binarizer = new HybridBinarizer(source);
            var binaryBitmap = new BinaryBitmap(binarizer);

            var reader = new MultiFormatReader();

            var result = reader.decode(binaryBitmap);

            return result?.Text;
        }
    }
}
