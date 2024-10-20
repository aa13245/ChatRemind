module.exports = (sequelize, DataTypes) => (
    sequelize.define('reminder', {
      content: {
        type: DataTypes.STRING(400),
        allowNull: false,
      },
      date: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      time: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      alert: {
        type: DataTypes.INTEGER(1),
        allowNull: true,
      },
      completed: {
        type: DataTypes.STRING(10),
        allowNull: true,
      },
    }, 
    {
      timestamps: true,
      paranoid: true,
    })
  );
  