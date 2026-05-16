const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} = require('discord.js');
const queues = require('../utils/queues');
const { formatDuration } = require('../utils/MusicQueue');

// userId → { mode: 'delete'|'swap', firstIdx: null|number, secondIdx: null|number }
const editStates = new Map();

function buildEmbed(queue) {
  const songs = queue?.songs ?? [];
  const songList = songs.slice(0, 25)
    .map((s, i) => `**${i + 1}.** ${s.title}\n${formatDuration(s.duration)} | ${s.channelName ?? '알 수 없음'}`)
    .join('\n');

  const embed = new EmbedBuilder()
    .setColor(0x9B59B6)
    .setTitle('대기열 편집모드')
    .setDescription(
      '대기열 편집모드가 사용중인 경우, 노래 추가, 다음곡 재생 등의 기능을 사용할 수 없어요.\n' +
      '🗑️ 삭제모드 - 대기열에서 선택된 곡을 제거합니다.\n' +
      '🔀 스왑모드 - 선택된 두 곡의 위치를 바꿉니다.\n' +
      '디스코드 API의 한계로, 최근 25곡의 노래까지만 표시됩니다.',
    );

  if (songList) embed.addFields({ name: '대기열', value: songList.slice(0, 1024) });

  return embed;
}

function buildSelectMenu(queue, state) {
  const menu = new StringSelectMenuBuilder().setCustomId('lyric_qm_select');
  const songs = queue?.songs ?? [];

  if (!songs.length) {
    return new ActionRowBuilder().addComponents(
      menu
        .setPlaceholder('대기열이 비어있어요')
        .setDisabled(true)
        .addOptions(new StringSelectMenuOptionBuilder().setLabel('없음').setValue('_none')),
    );
  }

  let placeholder;
  if (state.mode === 'delete') {
    placeholder = state.firstIdx !== null
      ? `삭제 선택됨: ${state.firstIdx + 1}번 곡`
      : '현재 편집모드 – 삭제모드';
  } else {
    if (state.secondIdx !== null) {
      placeholder = `스왑: ${state.firstIdx + 1}번 ↔ ${state.secondIdx + 1}번`;
    } else if (state.firstIdx !== null) {
      placeholder = `첫번째 선택됨 (${state.firstIdx + 1}번) – 두번째 곡을 선택하세요`;
    } else {
      placeholder = '현재 편집모드 – 스왑모드';
    }
  }

  return new ActionRowBuilder().addComponents(
    menu.setPlaceholder(placeholder).addOptions(
      songs.slice(0, 25).map((s, i) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(`${i + 1}. ${s.title.slice(0, 95)}`)
          .setValue(`${i}`)
          .setDescription(`${formatDuration(s.duration)} | ${s.channelName ?? '알 수 없음'}`.slice(0, 100)),
      ),
    ),
  );
}

function buildButtons(state) {
  const isSwap = state.mode === 'swap';
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('lyric_qm_trash')
      .setEmoji(isSwap ? '🔀' : '🗑️')
      .setStyle(isSwap ? ButtonStyle.Primary : ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('lyric_qm_confirm')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success),
  );
}

module.exports = {
  data: [
    new SlashCommandBuilder().setName('대기열관리').setDescription('대기열을 관리하는 명령어에요!'),
  ],

  async execute(interaction) {
    const queue = queues.get(interaction.guildId);
    if (!queue?.currentSong) {
      return interaction.reply({ content: '❌ 현재 재생 중인 노래가 없어요!', ephemeral: true });
    }

    const state = { mode: 'delete', firstIdx: null, secondIdx: null };
    editStates.set(interaction.user.id, state);

    return interaction.reply({
      ephemeral: true,
      embeds: [buildEmbed(queue)],
      components: [buildSelectMenu(queue, state), buildButtons(state)],
    });

  },

  async handleInteraction(interaction) {
    const queue = queues.get(interaction.guildId);
    const state = editStates.get(interaction.user.id) ?? { mode: 'delete', firstIdx: null, secondIdx: null };
    editStates.set(interaction.user.id, state);

    await interaction.deferUpdate();

    if (interaction.isStringSelectMenu()) {
      const value = interaction.values[0];
      if (value === '_none') {
        return interaction.editReply({
          embeds: [buildEmbed(queue)],
          components: [buildSelectMenu(queue, state), buildButtons(state)],
        });
      }

      const idx = parseInt(value);
      if (state.mode === 'delete') {
        state.firstIdx = idx;
      } else {
        if (state.firstIdx === null) {
          state.firstIdx = idx;
        } else if (idx !== state.firstIdx) {
          state.secondIdx = idx;
        }
      }
    } else if (interaction.isButton()) {
      if (interaction.customId === 'lyric_qm_trash') {
        // 모드 토글
        state.mode = state.mode === 'delete' ? 'swap' : 'delete';
        state.firstIdx = null;
        state.secondIdx = null;
      } else if (interaction.customId === 'lyric_qm_confirm') {
        if (state.mode === 'delete' && queue && state.firstIdx !== null && state.firstIdx < queue.songs.length) {
          queue.songs.splice(state.firstIdx, 1);
          await queue.updateNowPlaying();
          state.firstIdx = null;
        } else if (
          state.mode === 'swap' && queue &&
          state.firstIdx !== null && state.secondIdx !== null &&
          state.firstIdx < queue.songs.length && state.secondIdx < queue.songs.length
        ) {
          [queue.songs[state.firstIdx], queue.songs[state.secondIdx]] =
            [queue.songs[state.secondIdx], queue.songs[state.firstIdx]];
          await queue.updateNowPlaying();
          state.firstIdx = null;
          state.secondIdx = null;
        }
      }
    }

    return interaction.editReply({
      embeds: [buildEmbed(queue)],
      components: [buildSelectMenu(queue, state), buildButtons(state)],
    });
  },
};
