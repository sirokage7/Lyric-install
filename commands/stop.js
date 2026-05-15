const { SlashCommandBuilder } = require('discord.js');
const queues = require('../utils/queues');

module.exports = {
  data: [
    new SlashCommandBuilder().setName('stop').setDescription('Stop the current player!'),
    new SlashCommandBuilder().setName('종료').setDescription('현재 실행중인 플레이어를 종료시켜요!'),
  ],

  async execute(interaction) {
    const queue = queues.get(interaction.guildId);
    if (!queue) {
      return interaction.reply({ content: '❌ 현재 재생 중인 노래가 없어요!', ephemeral: true });
    }

    queue.destroy();

    return interaction.reply({ content: `<@${interaction.user.id}>님이 플레이어를 종료하셨어요!` });
  },
};
