using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using PasswordManagerAPI.Entities;
using PasswordManagerAPI.Services;
using Security.RSA;
using System.IdentityModel.Tokens.Jwt;
using System.Text;

namespace PasswordManagerAPI
{
    public class Program
    {
        public static void Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);

            var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
            builder.Services.AddDbContext<AppDbContext>(options =>
                options.UseSqlServer(connectionString));
            var key = Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"] ?? "default_key");
            builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
                .AddJwtBearer(options =>
                {
                    options.RequireHttpsMetadata = true;
                    options.SaveToken = true;
                    options.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuerSigningKey = true,
                        IssuerSigningKey = new SymmetricSecurityKey(key),
                        ValidateIssuer = true,
                        ValidateAudience = true,
                        ValidIssuer = builder.Configuration["Jwt:Issuer"],
                        ValidAudience = builder.Configuration["Jwt:Audience"],
                        ClockSkew = TimeSpan.Zero
                    };
                    options.Events = new JwtBearerEvents
                    {
                        OnTokenValidated = async context =>
                        {
                            var db = context.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
                            var userIdRaw = context.Principal?.FindFirst("userId")?.Value;
                            var jwtId = context.Principal?.FindFirst(JwtRegisteredClaimNames.Jti)?.Value;

                            if (!int.TryParse(userIdRaw, out var userId) || string.IsNullOrWhiteSpace(jwtId))
                            {
                                context.Fail("Invalid session claims");
                                return;
                            }

                            var session = await db.UserSessions.FirstOrDefaultAsync(x => x.UserId == userId && x.JwtId == jwtId);
                            if (session == null || session.RevokedAt != null || session.ExpiresAt <= DateTime.UtcNow)
                            {
                                context.Fail("Session is no longer active");
                                return;
                            }

                            session.LastSeenAt = DateTime.UtcNow;
                            await db.SaveChangesAsync();
                        }
                    };
                });

            builder.Services.AddCors(options =>
            {
                options.AddPolicy("AllowAll", policy =>
                {
                    policy.AllowAnyOrigin()
                          .AllowAnyMethod()
                          .AllowAnyHeader();
                });
            });

            builder.Services.AddControllers();
            builder.Services.AddHttpContextAccessor();

            builder.Services.AddScoped<IAccountService, AccountService>();
            builder.Services.AddScoped<RSAEncryption>();
            builder.Services.AddScoped<INoteService, NoteService>();
            builder.Services.AddScoped<IFavoriteService, FavoriteService>();
            builder.Services.AddScoped<ITotpService,TotpService>();
            builder.Services.AddScoped<ITotpAccountService, TotpAccountService>();
            builder.Services.AddScoped<IQrReaderService, QrReaderService>();
            builder.Services.AddScoped<IAuditService, AuditService>();
            builder.Services.AddScoped<IEmailSender, SmtpEmailSender>();
            builder.Services.AddScoped<IEmailVerificationService, EmailVerificationService>();
            builder.Services.AddScoped<PasswordPolicyService>();

            builder.Services.AddEndpointsApiExplorer();

            builder.WebHost.UseKestrel(options =>
            {
                var certPath = builder.Configuration["Kestrel:Endpoints:Https:Certificate:Path"];
                var certPassword = builder.Configuration["Kestrel:Endpoints:Https:Certificate:Password"];

                options.ListenAnyIP(7163, listenOptions =>
                {
                    listenOptions.UseHttps(certPath, certPassword);
                });
            });

            builder.Services.AddSwaggerGen(options =>
            {
                options.SwaggerDoc("v1", new OpenApiInfo { Title = "Password Manager API", Version = "v1" });

                options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
                {
                    Name = "Authorization",
                    Type = SecuritySchemeType.Http,
                    Scheme = "Bearer",
                    BearerFormat = "JWT",
                    In = ParameterLocation.Header
                });

                options.AddSecurityRequirement(new OpenApiSecurityRequirement
                {
                    {
                        new OpenApiSecurityScheme
                        {
                            Reference = new OpenApiReference
                            {
                                Type = ReferenceType.SecurityScheme,
                                Id = "Bearer"
                            }
                        },
                        new string[] {}
                    }
                });
            });

            var app = builder.Build();

            if (app.Environment.IsDevelopment())
            {
                app.UseSwagger();
                app.UseSwaggerUI();
            }

            app.UseHttpsRedirection();
            app.UseCors("AllowAll");
            app.UseAuthentication();
            app.UseAuthorization();
            app.MapControllers();

            using (var scope = app.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                EnsureSecuritySchema(db);
                db.Database.Migrate();
            }

            app.Run();
        }

        private static void EnsureSecuritySchema(AppDbContext db)
        {
            db.Database.ExecuteSqlRaw(
                """
                IF COL_LENGTH('Users', 'EmailConfirmed') IS NULL
                BEGIN
                    ALTER TABLE [Users] ADD [EmailConfirmed] bit NOT NULL CONSTRAINT [DF_Users_EmailConfirmed] DEFAULT(0);
                END
                """);

            db.Database.ExecuteSqlRaw(
                """
                IF EXISTS (
                    SELECT 1
                    FROM sys.columns
                    WHERE object_id = OBJECT_ID(N'[Users]')
                      AND name = 'Email'
                      AND max_length = -1
                )
                BEGIN
                    ALTER TABLE [Users] ALTER COLUMN [Email] nvarchar(450) NOT NULL;
                END
                """);

            db.Database.ExecuteSqlRaw(
                """
                IF NOT EXISTS (
                    SELECT 1
                    FROM sys.indexes
                    WHERE name = 'IX_Users_Email'
                      AND object_id = OBJECT_ID(N'[Users]')
                )
                BEGIN
                    CREATE UNIQUE INDEX [IX_Users_Email] ON [Users] ([Email]);
                END
                """);

            db.Database.ExecuteSqlRaw(
                """
                IF OBJECT_ID(N'[AuditLogs]', N'U') IS NULL
                BEGIN
                    CREATE TABLE [AuditLogs](
                        [Id] bigint IDENTITY(1,1) NOT NULL PRIMARY KEY,
                        [UserId] int NULL,
                        [SessionId] uniqueidentifier NULL,
                        [Action] nvarchar(100) NOT NULL,
                        [Details] nvarchar(2000) NULL,
                        [IpAddress] nvarchar(128) NULL,
                        [UserAgent] nvarchar(512) NULL,
                        [CreatedAt] datetime2 NOT NULL
                    );
                    CREATE INDEX [IX_AuditLogs_UserId_CreatedAt] ON [AuditLogs]([UserId], [CreatedAt]);
                END
                """);

            db.Database.ExecuteSqlRaw(
                """
                IF OBJECT_ID(N'[EmailVerificationCodes]', N'U') IS NULL
                BEGIN
                    CREATE TABLE [EmailVerificationCodes](
                        [Id] uniqueidentifier NOT NULL PRIMARY KEY,
                        [UserId] int NOT NULL,
                        [Purpose] nvarchar(32) NOT NULL,
                        [TargetEmail] nvarchar(256) NOT NULL,
                        [CodeHash] nvarchar(128) NOT NULL,
                        [CreatedAt] datetime2 NOT NULL,
                        [ExpiresAt] datetime2 NOT NULL,
                        [ConsumedAt] datetime2 NULL
                    );
                    CREATE INDEX [IX_EmailVerificationCodes_UserId_Purpose] ON [EmailVerificationCodes]([UserId], [Purpose]);
                END
                """);

            db.Database.ExecuteSqlRaw(
                """
                IF OBJECT_ID(N'[UserSessions]', N'U') IS NULL
                BEGIN
                    CREATE TABLE [UserSessions](
                        [Id] uniqueidentifier NOT NULL PRIMARY KEY,
                        [UserId] int NOT NULL,
                        [JwtId] nvarchar(64) NOT NULL,
                        [UserAgent] nvarchar(512) NULL,
                        [IpAddress] nvarchar(128) NULL,
                        [CreatedAt] datetime2 NOT NULL,
                        [LastSeenAt] datetime2 NOT NULL,
                        [ExpiresAt] datetime2 NOT NULL,
                        [RevokedAt] datetime2 NULL,
                        [RevokedReason] nvarchar(128) NULL
                    );
                    CREATE UNIQUE INDEX [IX_UserSessions_UserId_JwtId] ON [UserSessions]([UserId], [JwtId]);
                END
                """);
        }
    }
}
