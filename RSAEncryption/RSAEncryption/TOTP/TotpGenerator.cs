using System.Security.Cryptography;

namespace Security.TOTP
{
    public class TotpGenerator
    {
        private readonly byte[] _secret;
        private readonly int _digits;
        private readonly int _step;

        public TotpGenerator(byte[] secret, int digits = 6, int step = 30)
        {
            _secret = secret;
            _digits = digits;
            _step = step;
        }

        public string Generate()
        {
            long unixTime = TimeProvider.GetCurrentUnixTimeSeconds();
            long counter = TimeProvider.GetTimeStep(unixTime, _step);

            return GenerateForCounter(counter);
        }

        public bool Validate(string code, int allowedDrift = 1)
        {
            long unixTime = TimeProvider.GetCurrentUnixTimeSeconds();
            long currentCounter = TimeProvider.GetTimeStep(unixTime, _step);

            for (int i = -allowedDrift; i <= allowedDrift; i++)
            {
                string generated = GenerateForCounter(currentCounter + i);
                if (generated == code)
                    return true;
            }

            return false;
        }

        private string GenerateForCounter(long counter)
        {
            byte[] counterBytes = BitConverter.GetBytes(counter);

            if (BitConverter.IsLittleEndian)
                Array.Reverse(counterBytes);

            using var hmac = new HMACSHA1(_secret);
            byte[] hash = hmac.ComputeHash(counterBytes);

            int offset = hash[^1] & 0x0F;

            int binary = ((hash[offset] & 0x7f) << 24) | ((hash[offset + 1] & 0xff) << 16) | ((hash[offset + 2] & 0xff) << 8) | (hash[offset + 3] & 0xff);

            int otp = binary % (int)Math.Pow(10, _digits);

            return otp.ToString(new string('0', _digits));
        }
    }
}
