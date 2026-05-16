const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { loadCodes, saveCodes, generateCode } = require('../utils/adminCodes');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('관리자')
    .setDescription('관리자 코드 관리')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub.setName('코드발급').setDescription('새 관리자 코드를 발급해요.'),
    )
    .addSubcommand((sub) =>
      sub.setName('코드').setDescription('발급된 관리자 코드 목록을 확인해요.'),
    )
    .addSubcommand((sub) =>
      sub.setName('코드삭제').setDescription('발급된 관리자 코드를 삭제해요.'),
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();
    const codes = loadCodes();

    if (sub === '코드발급') {
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
      if (!codes.length) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xE74C3C)
              .setTitle('🔑 관리자 코드 목록')
              .setDescription('발급된 코드가 없어요.'),
          ],
        });
      }
      const list = codes.map((c, i) => `**${i + 1}.** \`${c.code}\``).join('\n');
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x9B59B6)
            .setTitle('🔑 관리자 코드 목록')
            .setDescription(list),
        ],
      });
    }

    if (sub === '코드삭제') {
      if (!codes.length) {
        return interaction.editReply({ content: '❌ 삭제할 코드가 없어요.' });
      }
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
