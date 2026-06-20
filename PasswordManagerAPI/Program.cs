using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using PasswordManagerAPI.Entities;
using PasswordManagerAPI.Services;
using System.IdentityModel.Tokens.Jwt;
using System.Threading.RateLimiting;

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
            var jwtKeyProvider = new JwtKeyProvider(builder.Configuration);
            builder.Services.AddSingleton(jwtKeyProvider);

            builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
                .AddJwtBearer(options =>
                {
                    options.RequireHttpsMetadata = true;
                    options.SaveToken = true;
                    options.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuerSigningKey = true,
                        IssuerSigningKey = jwtKeyProvider.ValidationKey,
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

            builder.Services.AddRateLimiter(options =>
            {
                options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
                options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
                    RateLimitPartition.GetFixedWindowLimiter(
                        GetRateLimitPartitionKey(context),
                        _ => new FixedWindowRateLimiterOptions
                        {
                            PermitLimit = 100,
                            Window = TimeSpan.FromMinutes(1),
                            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                            QueueLimit = 0
                        }));

                options.AddFixedWindowLimiter("Auth", limiterOptions =>
                {
                    limiterOptions.PermitLimit = 5;
                    limiterOptions.Window = TimeSpan.FromMinutes(1);
                    limiterOptions.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
                    limiterOptions.QueueLimit = 0;
                });

                options.AddFixedWindowLimiter("QrImport", limiterOptions =>
                {
                    limiterOptions.PermitLimit = 10;
                    limiterOptions.Window = TimeSpan.FromMinutes(1);
                    limiterOptions.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
                    limiterOptions.QueueLimit = 0;
                });
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
            builder.Services.AddScoped<INoteService, NoteService>();
            builder.Services.AddScoped<IFavoriteService, FavoriteService>();
            builder.Services.AddScoped<ITotpService,TotpService>();
            builder.Services.AddScoped<IQrReaderService, QrReaderService>();
            builder.Services.AddScoped<IAuditService, AuditService>();
            builder.Services.AddScoped<IEmailSender, SmtpEmailSender>();
            builder.Services.AddScoped<IEmailVerificationService, EmailVerificationService>();
            builder.Services.AddScoped<PasswordPolicyService>();
            builder.Services.AddScoped<SecurityHelper>();

            builder.Services.AddEndpointsApiExplorer();

            builder.WebHost.UseKestrel(options =>
            {
                options.ListenAnyIP(8080);
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
            app.UseRateLimiter();
            app.UseAuthentication();
            app.UseAuthorization();
            app.MapControllers();

            if (builder.Configuration.GetValue<bool>("Database:ApplyMigrationsOnStartup"))
            {
                using var scope = app.Services.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                db.Database.Migrate();
            }

            app.Run();
        }

        private static string GetRateLimitPartitionKey(HttpContext context)
        {
            return RequestMetadataHelper.GetClientIp(context) ?? "unknown";
        }
    }
}
