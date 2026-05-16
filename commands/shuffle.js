const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const queues = require('../utils/queues');
const { isRegistered } = require('../utils/adminCodes');

module.exports = {
  data: [
    new SlashCommandBuilder().setName('셔플').setDescription('대기열을 무작위로 셔플시키는 명령어에요!'),
  ],

  async execute(interaction) {
    if (!isRegistered(interaction.user.id)) {
      return interaction.reply({ content: '❌ 관리자 코드가 등록되지 않은 계정이에요. `/관리자 코드`로 먼저 등록해주세요!', ephemeral: true });
    }

    const queue = queues.get(interaction.guildId);
    if (!queue?.currentSong) {
      return interaction.reply({ content: '❌ 현재 재생 중인 노래가 없어요!', ephemeral: true });
    }
    if (queue.songs.length < 2) {
      return interaction.reply({ content: '❌ 셔플하려면 대기열에 2곡 이상이 필요해요!', ephemeral: true });
    }

    for (let i = queue.songs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue.songs[i], queue.songs[j]] = [queue.songs[j], queue.songs[i]];
    }

    await queue.updateNowPlaying();

    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x9B59B6).setDescription(`🔀 대기열 **${queue.songs.length}곡**을 무작위로 섞었어요!`)],
    });
  },
};
