module.exports = (sequelize, DataTypes) => (
    sequelize.define('chatlog', {
      content: {
        type: DataTypes.STRING(400),
        allowNull: false,
      },
      role: {
        type: DataTypes.STRING(10),
        allowNull: true,
      },
    }, 
    {
      timestamps: true,
      paranoid: true,
    })
  );
  