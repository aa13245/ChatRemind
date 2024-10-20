module.exports = (sequelize, DataTypes) => (
    sequelize.define('user', {
      email: {
        type: DataTypes.STRING(40),
        allowNull: true,
        unique: true,
      },
      password: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      username:{
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      chatbotname:{
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      GptApiKey: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      GptApiIv: {
        type: DataTypes.BLOB,
        allowNull: true,
      },
      GptMemory: {
        type: DataTypes.INTEGER(1),
        allowNull: true,
      },
      GptModel: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
    }, {
      timestamps: true,
      paranoid: true,
    })
  );