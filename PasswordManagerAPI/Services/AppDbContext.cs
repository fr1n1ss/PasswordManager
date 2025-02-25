using Microsoft.EntityFrameworkCore;
using PasswordManagerAPI.Entities;

namespace PasswordManagerAPI.Services
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }
        //Добавляем модели
        public DbSet<User> Users { get; set; }
        public DbSet<Account> Accounts { get; set; }
    }
}
