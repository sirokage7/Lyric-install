const { Client, Collection, GatewayIntentBits, ActivityType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const queues = require('./utils/queues');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages],
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'))) {
  const command = require(path.join(commandsPath, file));
  const dataList = Array.isArray(command.data) ? command.data : [command.data];
  for (const data of dataList) client.commands.set(data.name, command);
}

client.once('clientReady', () => {
  console.log(`✅ [Lyric] ${client.user.tag} 준비 완료!`);
  client.user.setActivity('/play 로 음악을 틀어봐요', { type: ActivityType.Listening });
});

client.on('interactionCreate', async (interaction) => {
  // 대기열 관리 인터랙션
  if (
    (interaction.isButton() && ['lyric_qm_trash', 'lyric_qm_confirm'].includes(interaction.customId)) ||
    (interaction.isStringSelectMenu() && interaction.customId === 'lyric_qm_select')
  ) {
    const queueManage = require('./commands/queue-manage');
    return queueManage.handleInteraction(interaction);
  }

  // 관리자 코드 삭제 셀렉트 메뉴
  if (interaction.isStringSelectMenu() && interaction.customId === 'admin_code_delete') {
    const admin = require('./commands/admin');
    return admin.handleDeleteSelect(interaction);
  }

  // 버튼 인터랙션
  if (interaction.isButton()) {
    const queue = queues.get(interaction.guildId);
    if (!queue?.currentSong) {
      return interaction.reply({ content: '❌ 현재 재생 중인 노래가 없어요!', ephemeral: true });
    }

    // ephemeral reply 필요한 버튼들
    if (interaction.customId === 'lyric_queue') {
      await interaction.deferReply({ ephemeral: true });
      return interaction.editReply({ embeds: [queue.getQueueEmbed()] });
    }

    if (interaction.customId === 'lyric_lyrics') {
      await interaction.deferReply({ ephemeral: true });
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle('가사 설정')
            .setDescription('가사를 설정하는 UI에요! 아래의 리스트에서 사용할 가사를 선택해주세요!'),
        ],
        components: [
          new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId('lyric_lyrics_select')
              .setPlaceholder('사용할 가사를 선택해주세요!')
              .setDisabled(true)
              .addOptions(new StringSelectMenuOptionBuilder().setLabel('개발중').setValue('_dev')),
          ),
        ],
      });
    }

    if (interaction.customId === 'lyric_playlist') {
      await interaction.deferReply({ ephemeral: true });
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle('플레이리스트 대시보드')
            .setDescription('플레이리스트 관련 기능을 실행하는 대시보드에요!'),
        ],
        components: [
          new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId('lyric_pl_mine')
              .setPlaceholder('내 플레이리스트')
              .setDisabled(true)
              .addOptions(new StringSelectMenuOptionBuilder().setLabel('개발중').setValue('_dev')),
          ),
          new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId('lyric_pl_recommend')
              .setPlaceholder('내가 추천한 플레이리스트')
              .setDisabled(true)
              .addOptions(new StringSelectMenuOptionBuilder().setLabel('개발중').setValue('_dev')),
          ),
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('lyric_pl_create')
              .setLabel('플레이리스트 만들기')
              .setStyle(ButtonStyle.Success)
              .setDisabled(true),
          ),
        ],
      });
    }

    await interaction.deferUpdate();

    switch (interaction.customId) {
      case 'lyric_stop': {
        const stopChannel = interaction.channel;
        queue.destroy();
        await stopChannel.send({ content: `<@${interaction.user.id}>님이 플레이어를 종료하셨어요!` });
        break;
      }
      case 'lyric_restart':
        queue.restart();
        break;
      case 'lyric_pause':
        if (!queue.pause()) queue.resume();
        await queue.updateNowPlaying();
        break;
      case 'lyric_skip':
        queue.skip();
        break;
      case 'lyric_shuffle':
        queue.shuffle();
        await queue.updateNowPlaying();
        break;
      case 'lyric_loop':
        queue.toggleLoop();
        await queue.updateNowPlaying();
        break;
      case 'lyric_vol_down':
      case 'lyric_vol_up':
      case 'lyric_star':
        await interaction.followUp({ content: '🔧 개발중인 기능이에요!', ephemeral: true });
        break;
    }
    return;
  }

  // 셀렉트 메뉴 인터랙션 (다음 곡 선택)
  if (interaction.isStringSelectMenu() && interaction.customId === 'lyric_queue_select') {
    const queue = queues.get(interaction.guildId);
    if (!queue?.currentSong) {
      return interaction.reply({ content: '❌ 현재 재생 중인 노래가 없어요!', ephemeral: true });
    }

    const value = interaction.values[0];
    if (value === '_empty') return interaction.deferUpdate();

    const index = parseInt(value.replace('skip_to_', ''));
    await interaction.deferUpdate();
    queue.skipToIndex(index);
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`[Lyric] 명령어 오류 (${interaction.commandName}):`, err);
    const reply = { content: '❌ 명령어 실행 중 오류가 발생했어요.', ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(reply).catch(() => {});
    } else {
      await interaction.reply(reply).catch(() => {});
    }
  }
});

client.on('voiceStateUpdate', async (oldState, newState) => {
  // 봇이 다른 채널로 이동됐을 때
  if (newState.id === client.user.id) {
    if (!newState.channelId || newState.channelId === oldState.channelId) return;
    const queue = queues.get(newState.guild.id);
    if (!queue) return;
    const conn = joinVoiceChannel({
      channelId: newState.channelId,
      guildId: newState.guild.id,
      adapterCreator: newState.guild.voiceAdapterCreator,
      selfDeaf: true,
    });
    conn.subscribe(queue.player);
    queue.connection = conn;
    return;
  }

  // 유저가 채널을 나갔을 때 봇만 남았는지 확인
  if (!oldState.channelId) return;
  const queue = queues.get(oldState.guild.id);
  if (!queue?.connection) return;

  const botChannelId = oldState.guild.members.me?.voice?.channelId;
  if (!botChannelId || botChannelId !== oldState.channelId) return;

  const humans = oldState.channel?.members.filter((m) => !m.user.bot);
  if (humans?.size !== 0) return;

  if (queue.npMessage) {
    await queue.npMessage.delete().catch(() => {});
    queue.npMessage = null;
  }
  if (queue.textChannel) {
    await queue.textChannel.send({ content: '채널에 아무도 존재하지 않아 플레이어가 자동으로 종료되었어요!' }).catch(() => {});
  }
  queue.destroy();
});

client.login(process.env.DISCORD_TOKEN);
