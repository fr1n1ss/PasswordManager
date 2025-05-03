using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
namespace PasswordManagerAPI.Entities
{
    [PrimaryKey(nameof(Id))]
    public class Favorite
    {
        public int Id { get; set; }
        [Required]
        public int UserId { get; set; }
        [Required]
        public string EntityType { get; set; }
        [Required]
        public int EntityId { get; set; }
        public DateTime AddedAt { get; set; }
    }

}
