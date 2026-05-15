const { Client, Collection, GatewayIntentBits, ActivityType } = require('discord.js');
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

  // 버튼 인터랙션
  if (interaction.isButton()) {
    const queue = queues.get(interaction.guildId);
    if (!queue?.currentSong) {
      return interaction.reply({ content: '❌ 현재 재생 중인 노래가 없어요!', ephemeral: true });
    }

    // 큐 보기는 ephemeral reply 필요 → deferUpdate 제외
    if (interaction.customId === 'lyric_queue') {
      await interaction.deferReply({ ephemeral: true });
      return interaction.editReply({ embeds: [queue.getQueueEmbed()] });
    }

    await interaction.deferUpdate();

    switch (interaction.customId) {
      case 'lyric_stop':
        queue.destroy();
        break;
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
        await queue.shuffle();
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

client.on('voiceStateUpdate', (oldState, newState) => {
  if (newState.id !== client.user.id) return;
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
});

client.login(process.env.DISCORD_TOKEN);
