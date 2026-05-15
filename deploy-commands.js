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

(async () => {
  try {
    console.log(`[Lyric] ${commands.length}개의 슬래시 커맨드 전역 등록 중...`);
    const data = await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );
    console.log(`[Lyric] ${data.length}개 커맨드 전역 등록 완료! (반영까지 최대 1시간 소요)`);
  } catch (err) {
    console.error('[Lyric] 커맨드 등록 실패:', err);
  }
})();
