const { SlashCommandBuilder } = require('discord.js');
const queues = require('../utils/queues');
const { isRegistered } = require('../utils/adminCodes');

module.exports = {
  data: [
    new SlashCommandBuilder()
      .setName('볼륨')
      .setDescription('볼륨을 조절하는 명령어에요!')
      .addIntegerOption((o) =>
        o.setName('볼륨').setDescription('0 ~ 100 사이의 수를 입력해주세요!').setRequired(true).setMinValue(0).setMaxValue(100),
      ),
  ],

  async execute(interaction) {
    if (!isRegistered(interaction.user.id)) {
      return interaction.reply({ content: '❌ 관리자 코드가 등록되지 않은 계정이에요. `/관리자 코드`로 먼저 등록해주세요!', ephemeral: true });
    }

    const queue = queues.get(interaction.guildId);
    if (!queue?.currentSong) {
      return interaction.reply({ content: '❌ 현재 재생 중인 노래가 없어요!', ephemeral: true });
    }

    const vol = interaction.options.getInteger('볼륨');
    queue.setVolume(vol);
    await queue.updateNowPlaying();

    return interaction.reply({ content: `🔊 볼륨을 **${vol}%** 로 설정했어요!`, ephemeral: true });
  },
};
