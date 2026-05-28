using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PasswordManagerAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddRSAFieldsToUser : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "EncryptedPrivateKey",
                table: "Users",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Modulus",
                table: "Users",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "PublicKey",
                table: "Users",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EncryptedPrivateKey",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "Modulus",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "PublicKey",
                table: "Users");
        }
    }
}
