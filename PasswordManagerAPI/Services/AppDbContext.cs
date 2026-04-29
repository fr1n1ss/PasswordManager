using Microsoft.EntityFrameworkCore;
using PasswordManagerAPI.Entities;

namespace PasswordManagerAPI.Services
{
    public class AppDbContext : DbContext
    {
        private const int UsernameMaxLength = 25;

        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }
        public DbSet<User> Users { get; set; }
        public DbSet<Account> Accounts { get; set; }
        public DbSet<Note> Notes { get; set; }
        public DbSet<Favorite> Favorites { get; set; }
        public DbSet<TotpAccount> TotpAccounts { get; set; }
        public DbSet<EmailVerificationCode> EmailVerificationCodes { get; set; }
        public DbSet<UserSession> UserSessions { get; set; }
        public DbSet<AuditLog> AuditLogs { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<User>()
                .Property(user => user.Username)
                .HasMaxLength(UsernameMaxLength)
                .IsRequired();
        }
    }
}
