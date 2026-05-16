const { SlashCommandBuilder } = require('discord.js');
const playdl = require('play-dl');
const { MusicQueue, Song } = require('../utils/MusicQueue');
const queues = require('../utils/queues');

const playOption = (builder) =>
  builder
    .addStringOption((o) =>
      o.setName('제목_또는_링크').setDescription('재생하실 노래의 제목 또는 URL을 입력해주세요.').setRequired(true),
    )
    .addBooleanOption((o) =>
      o.setName('셔플').setDescription('기존 대기열과 합친 뒤 무작위로 섞어요!').setRequired(false),
    );

module.exports = {
  data: [
    playOption(new SlashCommandBuilder().setName('play').setDescription('The command to play music!')),
    playOption(new SlashCommandBuilder().setName('재생').setDescription('노래를 재생하는 명령어에요!')),
  ],

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) {
      return interaction.editReply('🔇 먼저 음성 채널에 입장해 주세요!');
    }

    const perms = voiceChannel.permissionsFor(interaction.client.user);
    if (!perms?.has('Connect') || !perms?.has('Speak')) {
      return interaction.editReply('❌ 해당 채널에 접속하거나 말할 권한이 없어요.');
    }

    const query = interaction.options.getString('제목_또는_링크');
    const isUrl = /^https?:\/\//.test(query);

    const guildId = interaction.guildId;
    if (!queues.has(guildId)) queues.set(guildId, new MusicQueue(guildId));

    const queue = queues.get(guildId);
    queue.textChannel = interaction.channel;

    if (!queue.connection) {
      try {
        await queue.join(voiceChannel);
      } catch (err) {
        queues.delete(guildId);
        return interaction.editReply('❌ 음성 채널 연결에 실패했어요.');
      }
    }

    if (!queue.currentSong) await queue.showLoading();

    let song;
    try {
      if (isUrl) {
        const info = await playdl.video_info(query);
        const d = info.video_details;
        song = new Song({
          title: d.title ?? '제목 없음',
          url: d.url,
          duration: d.durationInSec,
          thumbnail: d.thumbnails?.[0]?.url ?? null,
          requestedBy: `<@${interaction.user.id}>`,
          channelName: d.channel?.name ?? '알 수 없음',
        });
      } else {
        const results = await playdl.search(query, { limit: 1, source: { youtube: 'video' } });
        if (!results?.length) return interaction.editReply('🔍 검색 결과가 없어요!');
        const pick = results[0];
        song = new Song({
          title: pick.title ?? '제목 없음',
          url: pick.url,
          duration: pick.durationInSec,
          thumbnail: pick.thumbnails?.[0]?.url ?? null,
          requestedBy: `<@${interaction.user.id}>`,
          channelName: pick.channel?.name ?? '알 수 없음',
        });
      }
    } catch (err) {
      console.error('[Lyric] 검색 오류:', err.message);
      return interaction.editReply('❌ 노래 검색 중 오류가 발생했어요.');
    }

    await queue.addSong(song);

    if (interaction.options.getBoolean('셔플') && queue.songs.length > 1) {
      for (let i = queue.songs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [queue.songs[i], queue.songs[j]] = [queue.songs[j], queue.songs[i]];
      }
      await queue.updateNowPlaying();
    }

    return interaction.deleteReply();
  },
};
