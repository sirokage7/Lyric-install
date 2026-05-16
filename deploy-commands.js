const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
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

(async () => {
  try {
    // 전역 커맨드 초기화
    console.log('[Lyric] 전역 커맨드 초기화 중...');
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: [] });
    console.log('[Lyric] 전역 커맨드 초기화 완료');

    // 봇에 로그인해서 길드 목록 가져오기
    const client = new Client({ intents: [GatewayIntentBits.Guilds] });
    await client.login(process.env.DISCORD_TOKEN);
    await client.guilds.fetch();

    const guilds = client.guilds.cache;
    console.log(`[Lyric] ${guilds.size}개 서버에 ${commands.length}개 커맨드 등록 중...`);

    for (const [guildId, guild] of guilds) {
      await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, guildId), { body: commands });
      console.log(`[Lyric] ✅ ${guild.name} (${guildId}) 등록 완료`);
    }

    console.log('[Lyric] 모든 서버 등록 완료! (즉시 반영)');
    await client.destroy();
  } catch (err) {
    console.error('[Lyric] 커맨드 등록 실패:', err);
    process.exit(1);
  }
})();
