const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const commands = [];
const commandsPath = path.join(__dirname, 'commands');

for (const file of fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'))) {
  const command = require(path.join(commandsPath, file));
  const dataList = Array.isArray(command.data) ? command.data : [command.data];
  for (const data of dataList) commands.push(data.toJSON());
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

const GUILD_IDS = process.env.GUILD_IDS
  ? process.env.GUILD_IDS.split(',').map((id) => id.trim())
  : [];

(async () => {
  try {
    // 전역 커맨드 전부 삭제 (중복 방지)
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: [] });
    console.log('[Lyric] 전역 커맨드 초기화 완료');

    // 길드 즉시 등록
    for (const guildId of GUILD_IDS) {
      const guildData = await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId),
        { body: commands },
      );
      console.log(`[Lyric] 길드 ${guildId} ${guildData.length}개 즉시 등록 완료`);
    }
  } catch (err) {
    console.error('[Lyric] 커맨드 등록 실패:', err);
  }
})();
