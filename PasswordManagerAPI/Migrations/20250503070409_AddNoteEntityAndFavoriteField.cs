using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PasswordManagerAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddNoteEntityAndFavoriteField : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsFavorite",
                table: "Accounts",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsFavorite",
                table: "Accounts");
        }
    }
}
