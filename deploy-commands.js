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
    // 전역 커맨드 초기화
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: [] });
    console.log('[Lyric] 전역 커맨드 초기화 완료');

    if (!GUILD_IDS.length) {
      console.error('[Lyric] .env에 GUILD_IDS가 없어요. 예: GUILD_IDS=123456789');
      process.exit(1);
    }

    console.log(`[Lyric] ${GUILD_IDS.length}개 서버에 ${commands.length}개 커맨드 등록 중...`);
    for (const guildId of GUILD_IDS) {
      await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId), { body: commands });
      console.log(`[Lyric] ✅ ${guildId} 등록 완료`);
    }
    console.log('[Lyric] 등록 완료! (즉시 반영)');
  } catch (err) {
    console.error('[Lyric] 커맨드 등록 실패:', err);
  }
})();
