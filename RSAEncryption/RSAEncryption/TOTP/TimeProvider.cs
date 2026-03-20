namespace Security.TOTP
{
    public static class TimeProvider
    {
        public static long GetCurrentUnixTimeSeconds() => DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        public static long GetTimeStep(long unixTime, int step = 30) => unixTime / step;
    }
}
