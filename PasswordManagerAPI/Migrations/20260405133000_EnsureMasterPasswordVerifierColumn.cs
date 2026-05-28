using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PasswordManagerAPI.Migrations
{
    /// <inheritdoc />
    public partial class EnsureMasterPasswordVerifierColumn : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                IF COL_LENGTH('Users', 'MasterPasswordVerifier') IS NULL
                BEGIN
                    ALTER TABLE [Users] ADD [MasterPasswordVerifier] nvarchar(max) NULL;
                END
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                IF COL_LENGTH('Users', 'MasterPasswordVerifier') IS NOT NULL
                BEGIN
                    ALTER TABLE [Users] DROP COLUMN [MasterPasswordVerifier];
                END
                """);
        }
    }
}
