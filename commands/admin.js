const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { loadCodes, saveCodes, generateCode, isRegistered, registerUser } = require('../utils/adminCodes');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('관리자')
    .setDescription('관리자 코드 관리')
    .addSubcommand((sub) =>
      sub.setName('코드발급').setDescription('새 관리자 코드를 발급해요. (관리자 전용)'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('코드')
        .setDescription('발급받은 관리자 코드를 등록해요.')
        .addStringOption((opt) =>
          opt.setName('코드').setDescription('발급받은 코드를 입력해주세요.').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('코드삭제').setDescription('발급된 관리자 코드를 삭제해요. (관리자 전용)'),
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

    if (sub === '코드발급') {
      if (!isAdmin) return interaction.editReply({ content: '❌ 서버 관리자만 사용할 수 있는 명령어에요!' });
      const codes = loadCodes();
      const newCode = generateCode();
      codes.push({ code: newCode, issuedAt: new Date().toISOString() });
      saveCodes(codes);
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle('✅ 관리자 코드 발급 완료')
            .setDescription(`새로운 관리자 코드가 발급되었어요!\n\n코드: \`${newCode}\``),
        ],
      });
    }

    if (sub === '코드') {
      const inputCode = interaction.options.getString('코드').trim().toUpperCase();
      if (isRegistered(interaction.user.id)) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xF39C12)
              .setTitle('이미 등록된 계정이에요!')
              .setDescription('이미 관리자 코드가 등록되어 있어요.'),
          ],
        });
      }
      const codes = loadCodes();
      const found = codes.find((c) => c.code === inputCode);
      if (!found) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xE74C3C)
              .setTitle('❌ 코드 오류')
              .setDescription('유효하지 않은 코드에요. 다시 확인해주세요.'),
          ],
        });
      }
      registerUser(interaction.user.id);
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle('✅ 코드 등록 완료')
            .setDescription('관리자 코드가 등록되었어요!\n이제 관리자 전용 기능을 사용할 수 있어요.'),
        ],
      });
    }

    if (sub === '코드삭제') {
      if (!isAdmin) return interaction.editReply({ content: '❌ 서버 관리자만 사용할 수 있는 명령어에요!' });
      const codes = loadCodes();
      if (!codes.length) return interaction.editReply({ content: '❌ 삭제할 코드가 없어요.' });
      const menu = new StringSelectMenuBuilder()
        .setCustomId('admin_code_delete')
        .setPlaceholder('삭제할 코드를 선택해주세요')
        .addOptions(
          codes.slice(0, 25).map((c) =>
            new StringSelectMenuOptionBuilder().setLabel(c.code).setValue(c.code),
          ),
        );
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle('🗑️ 관리자 코드 삭제')
            .setDescription('삭제할 코드를 선택해주세요.'),
        ],
        components: [new ActionRowBuilder().addComponents(menu)],
      });
    }
  },

  async handleDeleteSelect(interaction) {
    await interaction.deferUpdate();
    const codeToDelete = interaction.values[0];
    const codes = loadCodes();
    saveCodes(codes.filter((c) => c.code !== codeToDelete));
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x2ECC71)
          .setTitle('✅ 코드 삭제 완료')
          .setDescription(`코드 \`${codeToDelete}\` 가 삭제되었어요.`),
      ],
      components: [],
    });
  },
};
